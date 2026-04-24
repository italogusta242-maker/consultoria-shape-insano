## O que aconteceu

A tela de erro que você viu mostra:

> Failed to fetch dynamically imported module: .../assets/ChatNotificationToast-6_u1kG9M.js

Isso é um sintoma clássico de **chunk antigo após deploy novo**:

1. Seu navegador tinha o `index.html` antigo carregado em memória, que apontava para o arquivo `ChatNotificationToast-6_u1kG9M.js`.
2. Um deploy novo foi publicado → o Lovable subiu o app com hashes novos (`ChatNotificationToast-XXXXX.js`) e apagou os antigos.
3. Quando o React tentou carregar o componente `ChatNotificationToast` (via `lazy()` em `App.tsx:33`), o arquivo antigo já não existia mais → `Failed to fetch`.
4. O `ErrorBoundary` capturou e mostrou a tela "Algo deu errado".

Já existe o mecanismo `useSilentUpdate` que compara `__BUILD_VERSION__` com `/version.json` e faz hard-purge do cache, mas ele só roda no mount inicial e no focus da aba — não é acionado quando uma importação dinâmica falha no meio da navegação.

## O que vou ajustar

### 1. Auto-recover no ErrorBoundary
Em `src/components/ErrorBoundary.tsx`, detectar mensagens típicas de chunk stale:
- `Failed to fetch dynamically imported module`
- `Importing a module script failed`
- `error loading dynamically imported module`
- `ChunkLoadError`

Quando detectar uma dessas, **uma única vez** (com flag em `sessionStorage` para evitar loop):
- Chamar `hardPurgeCaches()` de `@/lib/pwaCache` (limpa Cache Storage + desregistra SW).
- Fazer `window.location.reload()` automaticamente.

Se já tentou recarregar uma vez e ainda assim deu o mesmo erro, mostra a tela atual com botão "Recarregar" (fallback manual), evitando loop infinito.

### 2. Listener global para promises rejeitadas
Adicionar em `src/main.tsx` um listener `window.addEventListener("unhandledrejection", ...)` que detecta o mesmo padrão de erro de chunk e dispara o mesmo fluxo de hard-purge + reload. Isso cobre casos em que o erro acontece fora do ciclo de render do React (ex: dentro de um `useEffect` async, prefetch de rota etc.).

### 3. Mensagem mais clara na tela de erro
Quando o erro for de chunk stale e o auto-recover não conseguir resolver (improvável, mas garantia), trocar a mensagem genérica por algo como:

> "Detectamos uma versão nova do app. Recarregando…"

Com um spinner durante o auto-reload, em vez do balão de erro técnico.

## Arquivos alterados

- `src/components/ErrorBoundary.tsx` — detecção + auto-recover + flag anti-loop.
- `src/main.tsx` — listener global de `unhandledrejection` para chunks.

Sem mudanças de schema, RLS, edge functions ou rotas. É puramente client-side.

## Resultado esperado

Da próxima vez que houver deploy novo enquanto Nicolas (ou qualquer usuário) estiver com a aba aberta, em vez de aparecer "Algo deu errado" o app vai automaticamente limpar o cache, recarregar e voltar a funcionar — sem ele precisar clicar em nada.