

## Correção em lote: `next_anamnese_due` desatualizado para 5 alunos

### Problema
5 alunos completaram a reavaliação mas o `next_anamnese_due` não foi atualizado (ficou em 21/03). O cron continua disparando notificações de anamnese pendente para todos eles.

### Correção (via insert tool — dados)

**1. Atualizar `next_anamnese_due` para cada aluno (30 dias após sua reavaliação):**

| Aluno | Reavaliação em | Novo `next_anamnese_due` |
|-------|---------------|------------------------|
| Danilo Victor | 05/04 | 2026-05-05 |
| Jean Willian | 25/03 | 2026-04-24 |
| Nicolas Macedo | 27/03 | 2026-04-26 |
| Paulo Ricardo | 27/03 | 2026-04-26 |
| Paulo Victor | 23/03 | 2026-04-22 |

**2. Marcar notificações `anamnese_request` como lidas** para todos os 5 alunos.

```sql
-- Danilo
UPDATE profiles SET next_anamnese_due = '2026-05-05' WHERE id = 'a85b237e-786b-4dbe-8630-216c1e90ee18';
-- Jean
UPDATE profiles SET next_anamnese_due = '2026-04-24' WHERE id = '59cd7d50-780c-4067-b1dd-558caa4e1828';
-- Nicolas
UPDATE profiles SET next_anamnese_due = '2026-04-26' WHERE id = 'd5d24b13-7c0c-4e2a-9ca7-acf903cbe62c';
-- Paulo Ricardo
UPDATE profiles SET next_anamnese_due = '2026-04-26' WHERE id = 'c7124f4c-42d6-4fbd-b5db-372a361c8caf';
-- Paulo Victor
UPDATE profiles SET next_anamnese_due = '2026-04-22' WHERE id = 'f7ade0bd-069f-4f95-8ded-660cbdc2445e';

-- Limpar notificações pendentes
UPDATE notifications SET read = true
WHERE user_id IN (
  'a85b237e-786b-4dbe-8630-216c1e90ee18',
  '59cd7d50-780c-4067-b1dd-558caa4e1828',
  'd5d24b13-7c0c-4e2a-9ca7-acf903cbe62c',
  'c7124f4c-42d6-4fbd-b5db-372a361c8caf',
  'f7ade0bd-069f-4f95-8ded-660cbdc2445e'
) AND type = 'anamnese_request' AND read = false;
```

### Nota sobre Nicolas
O Nicolas tem uma reavaliação sem fotos (mesmo bug do Diogo). Com o rollback já implementado, isso não vai mais acontecer.

### Arquivos
Nenhum arquivo de código alterado. Apenas correção de dados via insert tool.

