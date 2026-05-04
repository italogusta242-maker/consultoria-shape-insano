## Causa raiz

O toast **"Limpamos uma sessão de treino antiga salva neste aparelho"** vem de `src/pages/Treinos.tsx` linha 704, dentro de um `useEffect` (linhas 689–706) que dispara quando:

- `selectedGroup !== null` E
- `!hasValidSelectedGroup` (índice fora do array `workoutGroups`) OU
- `persistedGroupMismatch` (nome do grupo salvo ≠ nome do grupo no plano atual)

**O problema:** `workoutGroups` é derivado de `plan?.groups`. Quando o usuário volta para a aba (visibilitychange) ou o React Query refaz fetch (`refetchOnMount: "always"`), há uma janela em que `plan` é `undefined` momentaneamente → `workoutGroups` cai para `fallbackGroups` (3 grupos hardcoded: "Peito e Tríceps", "Costas e Bíceps", "Pernas").

Se o aluno está executando, por exemplo, o grupo `selectedGroup = 4` ("Push") do plano real:
- `hasValidSelectedGroup` vira `false` (4 ≥ 3 do fallback) **ou**
- `selectedGroupName` ("Peito e Tríceps" do fallback) ≠ `persisted.groupName` ("Push")

→ o effect varre `localStorage`, zera `exercises`, volta para `view="list"` e mostra o toast. Todo o progresso vai pro lixo no meio do treino.

Há ainda uma segunda armadilha: a query `training-plan` não tem `enabled` que aguarde o user e `plan` começa `undefined` durante o primeiro render após mount, ativando o mesmo caminho.

## Mudanças

### 1. `src/pages/Treinos.tsx` — neutralizar a limpeza automática

**a) Remover o `useEffect` de limpeza agressiva (linhas 689–706).** Em vez de varrer o snapshot, apenas mostramos a tela "Recarregando treino…" (já existe nas linhas 1006–1014) enquanto o plano não chega. Se o mismatch persistir mesmo após o plano carregar, mantemos a tela de recarregamento — sem deletar nada — e adicionamos um botão "Voltar para a lista" que o aluno pode acionar manualmente.

**b) Tornar `persistedGroupMismatch` resiliente a fallback:** só considerar mismatch quando temos certeza de que `plan` foi carregado (não usar `fallbackGroups` para invalidar). Adicionar guarda: `plan !== undefined && plan?.groups`.

**c) Effect de persistência (linhas 710–724):** trocar o `else if (view !== "execution") clearWorkoutExecutionSnapshot()` por uma condição mais estrita — só limpar quando `view === "list"` E o usuário explicitamente finalizou/cancelou. Hoje qualquer transição (incluindo re-render durante refetch) pode disparar.

   Solução prática: remover o `else if` desse effect e confiar apenas nas chamadas explícitas de `clearWorkoutExecutionSnapshot()` que já existem em finalizar (961), cancelar (991), auto-finalizar 3h (681) e nova abertura.

**d) Tela de fallback (linha 1006):** trocar texto "Recarregando treino…" por mensagem mais clara com botão de ação manual:
```
"Estamos recarregando seu plano. Se demorar, toque para voltar à lista (seu progresso continua salvo)."
[Voltar à lista]
```
O botão apenas faz `setView("list")` sem limpar snapshot — assim o aluno pode reentrar pelo `openGroup` que já tem lógica correta de restauração.

### 2. `src/lib/workoutSnapshot.ts` — remover invalidação por data

Hoje `loadWorkoutExecutionSnapshot` (linhas 64–78) deleta o snapshot se `parsed.date !== getToday()`. `getToday()` usa horário local, mas se o usuário começa um treino às 23:50 e termina 00:10, na próxima leitura o snapshot do "dia anterior" é apagado.

**Mudança:** trocar a regra de "data diferente → deletar" por "data > 24h → deletar". Comparar timestamp (`startedAt`) com `Date.now()`. Se `< 24h`, restaurar normalmente. Se `> 24h`, aí sim limpar (treino abandonado de verdade).

### 3. `src/pages/Treinos.tsx` — guarda no `openGroup` (linhas 789–800)

A condição `safeExercises.length === group.exercises.length` descarta o draft silenciosamente se o preparador editou o número de exercícios entre uma sessão e outra. Adicionar log/toast informativo ("Seu plano foi atualizado, começamos do zero") em vez de descartar mudo, mas **manter** o descarte (esse caso é legítimo).

## Resumo do comportamento após as mudanças

| Cenário | Antes | Depois |
|---|---|---|
| Aluno volta à aba durante refetch do plano | Snapshot apagado, toast "limpamos sessão antiga" | Tela "Recarregando…" até o plano chegar; snapshot intacto |
| Treino atravessa meia-noite (23:50 → 00:10) | Snapshot apagado ao voltar | Snapshot mantido (regra passa a ser 24h, não data) |
| Plano realmente mudou (índice inválido após plano carregar) | Limpeza automática + toast | Tela com botão "Voltar à lista"; snapshot só limpa se aluno tocar |
| Finalizar/cancelar treino | Limpa snapshot | Idêntico (chamadas explícitas mantidas) |

## Arquivos afetados

- `src/pages/Treinos.tsx` — remover effect de limpeza, ajustar `persistedGroupMismatch`, ajustar effect de persistência, melhorar tela de "Recarregando"
- `src/lib/workoutSnapshot.ts` — trocar invalidação por data por invalidação por idade (24h)
- `mem://features/training/persistence-resilience` — atualizar nota com a nova regra
