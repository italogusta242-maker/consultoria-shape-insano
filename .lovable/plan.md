

## Problema
Especialista usa PWA instalado no macOS (Safari/Chrome) e não recebe atualizações mesmo após "atualizar a página". O PWA fica preso em uma versão antiga.

## Por que acontece

O sistema atual depende de **dois gatilhos** para atualizar:
1. `useSilentUpdate` → recarrega quando `visibilityState === "hidden"` (usuário minimiza/troca de aba)
2. Service Worker com `skipWaiting` + `clientsClaim`

**No PWA standalone do macOS:**
- O usuário raramente "esconde" a janela — ele fecha ou deixa aberta o dia inteiro
- `Cmd+R` em PWA standalone **não força bypass do Service Worker** — o SW continua servindo o cache antigo
- O `reg.update()` em `main.tsx` só **detecta** atualização, não força ativação imediata se nada disparar `visibilitychange`

Resultado: o SW novo fica em estado `waiting` indefinidamente.

## Correção

**1. Forçar ativação imediata quando detectar SW novo (`useSilentUpdate.ts`)**

Quando `reg.waiting` existir, enviar `skipWaiting` mensagem e recarregar — sem depender de `visibilitychange`. Manter o guard do treino em andamento.

```ts
// Quando detectar waiting SW, ativar imediatamente
if (reg.waiting) {
  reg.waiting.postMessage({ type: "SKIP_WAITING" });
}
// E no controllerchange, recarregar (se não houver treino ativo)
navigator.serviceWorker.addEventListener("controllerchange", () => {
  if (!isWorkoutActive()) window.location.reload();
});
```

**2. Adicionar listener de `SKIP_WAITING` no Service Worker**

O `vite-plugin-pwa` com `skipWaiting: true` já faz isso automaticamente, mas para garantir, adicionar handler explícito no `push-handler.js`:

```js
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
```

**3. Polling periódico de update (fallback para PWA sempre aberto)**

Adicionar `setInterval` chamando `reg.update()` a cada 30 minutos no `main.tsx` ou `useSilentUpdate`, garantindo que mesmo PWAs abertos por dias detectem novas versões.

```ts
setInterval(() => reg.update(), 30 * 60 * 1000);
```

**4. Botão manual "Verificar atualização" no portal do especialista**

No header/menu do especialista, adicionar item discreto "Verificar atualizações" que chama `reg.update()` + reload forçado. Útil quando o especialista suspeita que está numa versão antiga.

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSilentUpdate.ts` | Forçar `skipWaiting` + reload em `controllerchange`. Adicionar polling de 30min. |
| `public/push-handler.js` | Listener de mensagem `SKIP_WAITING`. |
| `src/components/especialista/EspecialistaSidebar.tsx` (ou header) | Item "Verificar atualizações" no menu do usuário. |

## Comunicação ao usuário afetado
Após deploy, pedir para ele:
1. Fechar o PWA completamente (Cmd+Q)
2. Reabrir
3. A partir daí, atualizações futuras serão automáticas

