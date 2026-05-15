## Plano de Correções Cirúrgicas — `Treinos.tsx`

Aplicar as Prioridades **A, B, C, E** sem refatorar o arquivo inteiro. Três edições isoladas, todas em `src/pages/Treinos.tsx`, mais uma assinatura nova de hook auxiliar inline.

---

### Correção E — Restauração reativa pós-auth (iOS PWA / bf-cache)

**Onde:** `src/pages/Treinos.tsx`, linhas ~420–465.

**O que muda:**

1. Remover a leitura de `loadWorkoutExecutionSnapshot()` no topo do componente (executada no primeiro render, quando `user?.id` ainda é `undefined` no bf-cache do iOS).
2. Inicializar todos os states com valores neutros:
   - `view = "list"`, `selectedGroup = null`, `expandedExercise = null`
   - `exercises = []`, `startedAt = ""`, `timerRunning = false`, `timer = 0`
3. Adicionar um `useEffect` dependente de `user?.id` com guarda `hasRestoredRef`:

```ts
const hasRestoredRef = useRef(false);
useEffect(() => {
  if (!user?.id || hasRestoredRef.current) return;
  const persisted = loadWorkoutExecutionSnapshot();
  if (!persisted) { hasRestoredRef.current = true; return; }
  const belongs = persisted.userId == null || persisted.userId === user.id;
  if (!belongs) { hasRestoredRef.current = true; return; }
  const safe = sanitizeExercises(persisted.exercises);
  setExercises(safe);
  setSelectedGroup(persisted.selectedGroup);
  setExpandedExercise(persisted.expandedExercise);
  setStartedAt(persisted.startedAt);
  setView(persisted.view);
  if (persisted.startedAt && persisted.view === "execution") {
    setTimerRunning(true);
    setTimer(Math.floor((Date.now() - new Date(persisted.startedAt).getTime()) / 1000));
  }
  hasRestoredRef.current = true;
}, [user?.id]);
```

Garantia: roda **uma única vez** após o `user` estar disponível, evita race condition do primeiro render. O `handleConclude` continua intocado (lê dos states atuais).

---

### Correção C — Fim do "bug da meia-noite" no per-group draft

**Onde:** `src/pages/Treinos.tsx`, função `openGroup`, linhas ~774–805.

**O que muda:**

- Remover a condição `parsed.date === todayStr` do `if` de restauração.
- Remover o cálculo `const todayStr = getToday();` (não usado mais).
- Manter as validações de `matchesGroupName`, `matchesUser` e contagem de exercícios.
- Limpeza continua exclusivamente nas ações explícitas (Finalizar / Cancelar / 3h auto-finalize).

Bloco final:

```ts
if (matchesGroupName && matchesUser && safeExercises.length === group.exercises.length) {
  setExercises(safeExercises);
  setSelectedGroup(index);
  setExpandedExercise(null);
  setView("detail");
  return;
}
```

---

### Correção A & B — `getNextGroupIndex` por rotação cíclica + cache fresh

**Onde:** `src/pages/Treinos.tsx`, linhas ~487–501 (query) e ~756–762 (cálculo).

**Parte 1 — Query React Query** (linha 487): adicionar `refetchOnMount: "always"`:

```ts
const { data: workoutHistory = [] } = useQuery({
  queryKey: ["workout-history", user?.id],
  queryFn: async () => { /* mantém */ },
  enabled: !!user,
  refetchOnMount: "always",
});
```

**Parte 2 — Heurística** (linhas 756–762): substituir o algoritmo `indexOf(Math.min(counts))` por rotação cíclica pura baseada **apenas no último treino finalizado**:

```ts
const getNextGroupIndex = useCallback(() => {
  if (workoutGroups.length === 0) return 0;
  const lastFinished = workoutHistory.find((w) => w.finished_at);
  if (!lastFinished) return 0;
  const lastIdx = workoutGroups.findIndex(
    (g) => g.name.trim().toLowerCase() === (lastFinished.group_name ?? "").trim().toLowerCase()
  );
  if (lastIdx === -1) return 0; // grupo renomeado: começa do A
  return (lastIdx + 1) % workoutGroups.length;
}, [workoutGroups, workoutHistory]);
```

Comportamento: A → B → C → A. Se o último treino não casa com nenhum grupo (renomeado pelo preparador), volta para o índice 0 em vez de travar.

---

### Validação final

- `handleConclude` não é tocado — segue lendo dos states.
- Snapshot continua sendo salvo a cada ação (lógica de persistência intacta).
- `clearWorkoutInProgress` continua sendo chamada apenas em finalize/cancel.
- Sem mudanças de tipos, sem mudanças de imports além de `useRef`/`useEffect` (já presentes).

### Arquivos modificados

- `src/pages/Treinos.tsx` (3 edições isoladas)
