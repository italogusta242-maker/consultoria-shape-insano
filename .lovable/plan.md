
Objetivo: corrigir o “carregando sem parar / não loga” que está afetando todos os usuários, atacando o fluxo global de bootstrap da autenticação e eliminando pontos onde a app pode ficar presa sem fallback.

Diagnóstico mais provável a partir do código:
- O splash global vem de `App.tsx` quando `useAuth().loading` fica `true`.
- Em `src/contexts/AuthContext.tsx`, o loading só termina depois de `fetchOnboarded()` e `checkRoleAndRedirect()`.
- Essas chamadas assíncronas não estão protegidas com `try/catch/finally`. Se uma delas falhar, travar, ou rejeitar, o app pode ficar preso para sempre no splash.
- Há um agravante: quando existe sessão (`hasSession = true`), o timeout de segurança de 3s deixa de destravar o app. Ou seja: basta existir sessão + falha em query para congelar indefinidamente.
- Nos guards (`RoleGuard` e `StudentGuard`), quando a checagem demora/falha eles retornam `null`, o que pode virar tela vazia para áreas protegidas.
- Como o projeto é PWA e já teve problema estrutural de build/cache, usuários podem continuar vendo um bundle antigo que mantém esse comportamento.

Plano de implementação:
1. Blindar o bootstrap do `AuthContext`
- Envolver `fetchOnboarded` + `checkRoleAndRedirect` em `try/catch/finally`.
- Garantir `setLoading(false)` sempre, mesmo com erro.
- Separar “resolver sessão” de “buscar dados auxiliares”, para a app não depender dessas queries para sair do splash.
- Adicionar timeout real também para sessão existente, não só para “sem sessão”.

2. Tornar `fetchOnboarded` e redirecionamento fail-safe
- `fetchOnboarded`: se falhar, assumir `false` e seguir.
- `checkRoleAndRedirect`: se falhar, não bloquear a renderização; apenas registrar erro e continuar na rota atual.
- Evitar `setTimeout(async () => ...)` sem proteção, porque rejeições ali escapam fácil.

3. Melhorar guards para não virarem tela vazia
- Em `RoleGuard` e `StudentGuard`, trocar `return null` por um fallback visível e temporizado.
- Se a consulta de roles falhar, redirecionar ou mostrar estado de erro controlado, em vez de ficar invisível.

4. Revisar o fluxo de login
- No `signIn`, impedir que `postLoginLoading` sustente a splash por tempo desnecessário.
- Fazer o pós-login depender da resolução real do bootstrap, não de timer fixo.
- Garantir que erro de login sempre remova qualquer estado pendente.

5. Validar o caminho PWA/cache junto com essa correção
- Conferir se o fluxo atual de versionamento/purge continua ativo para produção.
- Se necessário, reforçar o “fail-open” para usuários presos em build antigo: ao detectar mismatch, limpar cache/SW e recarregar sem depender do bootstrap auth.

Arquivos principais a ajustar:
- `src/contexts/AuthContext.tsx`
- `src/components/RoleGuard.tsx`
- `src/components/StudentGuard.tsx`
- possivelmente `src/App.tsx` para um fallback global mais resiliente
- revisar também `src/hooks/useSilentUpdate.ts` e `src/lib/pwaCache.ts` só para confirmar que o mecanismo de recuperação de cache não está regressando

Resultado esperado:
- mesmo que backend/roles/profile falhem, o app não fica mais preso em “Carregando...”
- login passa a falhar de forma explícita ou entrar normalmente
- áreas protegidas deixam de ficar em branco
- usuários presos em bundle antigo têm caminho automático/manual de recuperação

Detalhes técnicos:
- O bug central é de “bootstrap blocking”: hoje a UI depende de queries secundárias para sair do estado inicial.
- A correção deve transformar o fluxo em “auth first, enrichment later”:
```text
resolver sessão
  -> liberar app
  -> buscar perfil/roles em paralelo
  -> redirecionar se necessário
  -> se falhar, seguir com fallback seguro
```
- Isso reduz o risco de travamento global e combina com o histórico recente de problemas de cache/deploy.

Depois de implementar:
- testar login sem sessão
- testar login com sessão persistida
- testar usuário aluno
- testar usuário especialista/admin
- testar com falha simulada em `profiles` / `user_roles`
- validar no publicado e no PWA instalado, para garantir que não existe mais loop de carregamento
