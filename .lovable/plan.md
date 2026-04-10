

## Problema

A página "Ver Anamnese" do especialista (`/especialista/anamnese/:studentId`) só mostra a **anamnese inicial** (tabela `anamnese`). As **reavaliações mensais** (tabela `monthly_assessments`) não são buscadas nem exibidas em lugar nenhum. Além disso, o `submitMonthlyAssessment` não notifica os especialistas quando um aluno envia uma reavaliação.

São 3 correções combinadas:

1. **Notificar especialistas** quando aluno submete reavaliação mensal
2. **Exibir reavaliações mensais** na página de anamnese do especialista
3. **Permitir marcar como revisada** a reavaliação mensal

## Alterações

### 1. Notificar especialistas após submit
**Arquivo:** `src/lib/submitMonthlyAssessment.ts`
- Após insert bem-sucedido, buscar especialistas vinculados via `student_specialists`
- Inserir notificação tipo `monthly_completed` para cada especialista com nome do aluno

### 2. Exibir reavaliações mensais na tela do especialista
**Arquivo:** `src/pages/especialista/EspecialistaAnamneseSplit.tsx`
- Adicionar query para buscar `monthly_assessments` do aluno (ordenado por `created_at DESC`)
- Criar nova seção "Reavaliações Mensais" com timeline navegável (como já existe para anamneses iniciais)
- Exibir campos: peso, altura, modalidade, nível fadiga, progressão muscular, dias disponíveis, adesão treinos/cardio/dieta, objetivo atual, fotos, sugestões
- Botão "Marcar como revisada" que atualiza `reviewed`, `reviewed_by`, `reviewed_at`
- Badge visual indicando se está pendente de revisão ou já revisada

### 3. Reduzir cache do dashboard
**Arquivo:** `src/pages/especialista/EspecialistaDashboard.tsx`
- Reduzir `refetchInterval` para alertas proativos de 5min para 2min

## Resumo

| Arquivo | Mudança |
|---------|---------|
| `src/lib/submitMonthlyAssessment.ts` | Notificar especialistas vinculados |
| `src/pages/especialista/EspecialistaAnamneseSplit.tsx` | Seção de reavaliações mensais com timeline e revisão |
| `src/pages/especialista/EspecialistaDashboard.tsx` | Reduzir cache interval |

