## Mudança

### 1. `src/lib/workoutSnapshot.ts`

- Remover a constante `MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000`.
- Em `loadWorkoutExecutionSnapshot()`, remover o bloco que calcula `startedTs` e deleta a chave quando `Date.now() - startedTs > MAX_SNAPSHOT_AGE_MS`.
- Manter o `try/catch`: se `JSON.parse` falhar ou o payload for vazio, ainda removemos a chave (proteção contra corrupção).
- Manter `getToday` import? Sim — ainda é usado em `saveWorkoutExecutionSnapshot` e `saveWorkoutInProgress` para gravar o campo `date`.

Resultado: `load` apenas lê e devolve o snapshot. Não há mais expiração passiva.

### 2. `mem://features/training/persistence-resilience`

Adicionar nota:
> O snapshot local de treino não possui mais expiração automática por tempo (TTL) no load. A sessão persiste indefinidamente no aparelho até ser encerrada por uma ação explícita do usuário na UI (Finalizar / Cancelar / Auto-Finalizar 3h ativo / Abrir novo grupo via `openGroup`).

## Garantias mantidas

- `clearWorkoutExecutionSnapshot()` segue isolado: só é chamado em finalizar, cancelar, auto-finalizar 3h e `openGroup`.
- Se o aluno minimizar o app por horas/dias e voltar, cai direto no `view="execution"` com os mesmos checks.
- Proteção contra JSON corrompido permanece (catch remove a chave).

## Arquivos afetados

- `src/lib/workoutSnapshot.ts`
- `mem://features/training/persistence-resilience`
