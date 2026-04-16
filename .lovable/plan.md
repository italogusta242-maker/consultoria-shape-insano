

## Bugs identificados no Split View da Anamnese

### Bug 1: Botão "Salvar" some no modo expandido

**Causa:** Em `EspecialistaAnamneseSplit.tsx` (linha 802-817), quando entra no modo `editor-only`, é renderizado um header extra (`<div className="p-3 border-b ...">`) acima do `TrainingPlanEditor`. Mas o editor renderiza `<div className="flex flex-col h-full bg-card">` (`h-full` = 100% do pai).

Resultado: header + 100% do pai = overflow vertical. O footer com o botão "Salvar" (linha 856-868 do editor) fica empurrado para fora da viewport.

**Fix:** O wrapper direito (`viewMode === "editor-only" ? "w-full" : "w-1/2"`) precisa virar um container flex próprio (`flex-col`), com o header como item de altura fixa e o editor com `flex-1 min-h-0` para ocupar o resto. Trocar `h-full` do editor embedded por `h-full min-h-0` (`min-h-0` permite ao flex child encolher corretamente dentro do pai flex).

### Bug 2: Progresso some ao voltar do modo expandido para o split

**Causa:** Em `EspecialistaAnamneseSplit.tsx` (linhas 837-846), o `editingPlan` é construído inline a cada render como objeto novo:
```tsx
editingPlan={editingPlan || (existingTrainingPlan ? {
  id: existingTrainingPlan.id,
  groups: Array.isArray(...) ? [...] : [],
  ...
} : null)}
```

Quando o usuário troca `viewMode`, o componente pai re-renderiza → novo objeto literal → prop `editingPlan` muda de identidade.

Dentro de `TrainingPlanEditor.tsx` (linha 96-125), o `useEffect` tem `editingPlan` como dependência e, quando dispara, faz `setDraft(...)` resetando o draft do Zustand com os dados ANTIGOS do banco — sobrescrevendo todas as alterações não-salvas.

**Fix:** Memoizar o `editingPlan` derivado com `useMemo`, dependendo apenas dos campos primitivos relevantes (`existingTrainingPlan?.id`, `updated_at`). Assim o objeto só muda quando o plano real do banco muda, não a cada re-render do split. Mesma correção para `existingDietPlan`.

Adicionalmente, blindar o `useEffect` do editor (linha 96-125) para só resetar o draft quando o **id** do `editingPlan` muda (não a referência), evitando regressões futuras.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/especialista/EspecialistaAnamneseSplit.tsx` | (1) Wrapper direito com layout flex correto; (2) `useMemo` no `editingPlan` derivado para Treino e Dieta |
| `src/components/especialista/TrainingPlanEditor.tsx` | `useEffect` de inicialização passa a depender de `editingPlan?.id` em vez do objeto inteiro; container embedded usa `h-full min-h-0` |
| `src/components/especialista/DietPlanEditor.tsx` | Mesma correção do `useEffect` (depender do id) e do container embedded |

Sem mudanças de banco. O draft do Zustand já é por aluno, então o conteúdo está preservado — só precisamos parar de sobrescrevê-lo.

