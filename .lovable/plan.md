

## Problema confirmado

O Athos tem **0 registros** na `monthly_assessments`. Se ele preencheu 3 vezes, os envios falharam. Causas prováveis:

1. **Bug no AnamneseRequestAlert**: ao clicar "PREENCHER AGORA", a notificação é marcada como `read: true` antes do envio. O alerta some, o aluno acha que completou.
2. **Erro silencioso no submit**: o `submitMonthlyAssessment` usa `as any` para bypass de tipos. Se o insert falha, o erro é exibido como toast mas pode não ser notado.
3. **Banner do Dashboard não aparece**: usa lógica de `daysSinceAnamnese >= 30` ao invés de `next_anamnese_due`, então alunos recentes não veem o lembrete.

## Correções

### 1. AnamneseRequestAlert — Não marcar como lido ao clicar
**Arquivo:** `src/components/AnamneseRequestAlert.tsx`
- Remover `update({ read: true })` da função `markReadAndNavigate`
- Apenas navegar para `/reavaliacao`
- A notificação será marcada como lida apenas após o submit bem-sucedido (já feito em `submitMonthlyAssessment.ts`)

### 2. Dashboard banner — Usar `next_anamnese_due`
**Arquivo:** `src/pages/Dashboard.tsx`
- Alterar a condição do `MonthlyAnamnesisBanner` para verificar `profile.next_anamnese_due <= hoje`
- Garantir que o banner aparece para todos com reavaliação vencida

### 3. Melhorar feedback de erro no submit
**Arquivo:** `src/lib/submitMonthlyAssessment.ts`
- Adicionar logging mais detalhado
- Garantir que erros de insert são exibidos claramente ao usuário

### 4. Cron reenviar notificação
**Arquivo:** `supabase/functions/check-stale-plans/index.ts`
- Se `next_anamnese_due` venceu e não há `monthly_assessment` recente, reinserir notificação `anamnese_request` (se não existir uma não-lida)

| Arquivo | Mudança |
|---------|---------|
| `src/components/AnamneseRequestAlert.tsx` | Não marcar notificação como lida ao clicar |
| `src/pages/Dashboard.tsx` | Banner baseado em `next_anamnese_due` |
| `src/lib/submitMonthlyAssessment.ts` | Melhorar feedback de erro |
| `supabase/functions/check-stale-plans/index.ts` | Reenviar notificação se não respondida |

