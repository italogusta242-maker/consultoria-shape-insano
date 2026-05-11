## Visão Geral

Os alertas de "Anamnese pendente" no painel do especialista não são linhas de uma tabela `anamnesis_requests` — eles são derivados em tempo real pelo hook `useProactiveAlerts.ts` a partir de `anamnese`, `monthly_assessments` e `profiles.next_anamnese_due`. Hoje já existe a tabela `dismissed_alerts` (specialist_id + alert_key + student_id) usada para "dispensar" alertas.

A forma mais limpa e consistente de implementar a "Soneca" é **estender `dismissed_alerts`** para virar também um registro de "suspensão temporária", em vez de criar uma tabela paralela.

## Mudanças no Banco

Adicionar à tabela `dismissed_alerts`:
- `trainer_alert_status` text NOT NULL DEFAULT `'dismissed'` — valores: `'dismissed'` (comportamento atual: oculta para sempre), `'suspended'` (nova soneca).
- `trainer_alert_reason` text NULL — motivo escolhido.
- `trainer_alert_expires_at` timestamptz NULL — quando vira `NULL` é tempo indeterminado.

Sem migração de dados (o default cobre as linhas existentes). RLS já está ok (specialist gerencia as próprias linhas).

## Lógica de Filtragem (sem cron)

Em `useProactiveAlerts`, trocar o `Set<alert_key>` por um `Map<alert_key, { status, expires_at }>` e classificar cada alerta gerado em três buckets:

```text
ATIVO   → não tem registro
        OU status='suspended' AND expires_at IS NOT NULL AND expires_at < NOW()
SUSPENSO→ status='suspended' AND (expires_at IS NULL OR expires_at > NOW())
OCULTO  → status='dismissed' (comportamento atual mantido)
```

O hook passa a retornar `{ active: ProactiveAlert[], suspended: (ProactiveAlert & { reason, expiresAt })[] }` para a UI consumir os dois grupos sem refazer a lógica.

A "ressureição" no vencimento acontece automaticamente porque a query reavalia `expires_at < NOW()` a cada refetch (já existe `refetchInterval: 5min`).

## Mudanças na UI (`EspecialistaDashboard.tsx`)

1. **Card de alerta** — adicionar menu de 3 pontinhos (`MoreVertical`) com:
   - "Suspender Aviso" → abre modal
   - "Dispensar" (item já existente migrado pra dentro do menu)

2. **Modal de Suspensão** (novo componente `SuspendAlertModal.tsx` em `src/components/especialista/`):
   - Radio "Motivo": Sem resposta do aluno · Aluno vai responder depois · Outros
   - Radio "Prazo": Indeterminado · 3 dias · 7 dias · Data específica (DatePicker via `<Calendar>`)
   - Confirma → upsert em `dismissed_alerts` com `status='suspended'`, `reason`, `expires_at`.

3. **Seção "Aguardando Aluno"** — `<Collapsible>` no final da página, mostrando os alertas com status suspenso. Cada item exibe:
   - Badge com motivo
   - Texto "volta em X dias" ou "indeterminado"
   - Botão "Retornar para Urgentes" → upsert com `status='dismissed'` e depois delete, ou simplesmente `delete` da linha (mais simples — limpa a soneca e o alerta volta no próximo render).

4. O escopo se aplica apenas aos alertas dos tipos `anamnese_review_pending`, `monthly_pending`, `monthly_awaiting_review`, `assessment_overdue` (família "anamnese"). Os outros tipos mantêm o comportamento atual.

## Reativação no Submit do Aluno

Ao submeter anamnese (`src/lib/submitAnamnese.ts`) e ao submeter reavaliação mensal (`src/lib/submitMonthlyAssessment.ts`), após sucesso:

```ts
await supabase.from("dismissed_alerts")
  .delete()
  .eq("student_id", user.id)
  .in("alert_key", ["anamnese-review-…", "monthly-pending-…", "assessment-never-…"]);
```

Como `alert_key` inclui o `studentId` no formato `monthly-pending-${sid}`, basta um delete por padrão `like 'monthly-%-' || user.id` ou listar as chaves possíveis. Isso "ressuscita" o alerta como `anamnese_review_pending` (aguardando revisão do especialista) na próxima query.

## Arquivos Tocados

- `supabase/migrations/<timestamp>_snooze_alerts.sql` (nova migração: 3 colunas)
- `src/hooks/useProactiveAlerts.ts` (lógica de buckets + nova mutation `suspendAlert`)
- `src/components/especialista/SuspendAlertModal.tsx` (novo)
- `src/pages/especialista/EspecialistaDashboard.tsx` (menu, modal, accordion "Aguardando Aluno")
- `src/lib/submitAnamnese.ts` e `src/lib/submitMonthlyAssessment.ts` (limpeza de soneca no submit)

## Notas Técnicas

- Sem cron job — toda a "expiração" é decidida em query time comparando `expires_at` com `new Date()` no client.
- `dismissed_alerts` já tem `unique(specialist_id, alert_key)` via upsert; mantém-se.
- `src/integrations/supabase/types.ts` será atualizado automaticamente após a migração.