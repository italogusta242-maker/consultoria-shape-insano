

## Diagnóstico: App travando e fechando durante treino

### Causa raiz #1 — Reload silencioso MATA o treino (CRÍTICO)

O hook `useSilentUpdate` detecta quando um Service Worker novo é instalado e **recarrega a página inteira quando o usuário minimiza o app ou bloqueia a tela**:

```typescript
// useSilentUpdate.ts — linha 47
if (document.visibilityState === "hidden" && newSwInstalled.current) {
  window.location.reload(); // ← MATA O TREINO
}
```

O fluxo é: aluno está treinando → bloqueia tela ou troca de app para trocar música → SW atualizado em background → `reload()` dispara → o app reinicia e o treino em execução é perdido.

Embora o localStorage persista o estado, o reload causa:
- Perda do timer de descanso ativo
- Re-fetch de todos os dados
- Possível dessincronização do estado se o write não completou

### Causa raiz #2 — `backdrop-blur` no timer de descanso (Performance)

O overlay do RestTimer usa `backdrop-blur-sm` em tela cheia. Em dispositivos móveis de baixo/médio porte, isso causa travamento porque o GPU precisa re-amostrar todos os pixels abaixo do overlay a cada frame, especialmente com animações do SVG do timer rodando.

### Causa raiz #3 — N+1 queries no hook de não lidos (Performance geral)

O `useUnreadConversations` dispara uma query individual para CADA conversa do usuário sequencialmente. Os logs de rede mostram ~30 requests separados para `chat_messages`, um por conversa. Isso é pesado e pode travar o app durante esses disparos em série.

---

### Plano de correção

#### 1. Bloquear reload silencioso durante treino ativo
**Arquivo:** `src/hooks/useSilentUpdate.ts`

Antes de executar `window.location.reload()`, verificar se existe `workout-execution-state` no localStorage. Se existir, adiar o reload para quando o treino terminar.

```
Se localStorage["workout-execution-state"] existir → NÃO recarregar
Quando o treino finalizar/cancelar → verificar flag e recarregar
```

#### 2. Remover backdrop-blur do RestTimer
**Arquivo:** `src/pages/Treinos.tsx`

Trocar `bg-background/80 backdrop-blur-sm` por `bg-background/95` (cor sólida com opacidade alta). Visualmente quase igual, mas sem custo de GPU.

#### 3. Otimizar query de não lidos em batch
**Arquivo:** `src/hooks/useUnreadConversations.ts`

Substituir o loop de N queries individuais por uma única query usando `in()` com todos os IDs de conversa, e calcular os counts no client.

#### 4. Melhorar resiliência do timer após reload inesperado
**Arquivo:** `src/pages/Treinos.tsx`

Quando o estado é restaurado do localStorage, restaurar também o timer de execução calculando o tempo elapsed desde `startedAt`, para que um reload não zere o cronômetro.

---

### Resumo de arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSilentUpdate.ts` | Não recarregar durante treino ativo |
| `src/pages/Treinos.tsx` | Remover backdrop-blur do RestTimer + melhorar restore |
| `src/hooks/useUnreadConversations.ts` | Batch query único em vez de N+1 |

