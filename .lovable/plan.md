

## Problema

O sistema gera até **8 tipos de alerta por aluno** (sem plano, inativo, reavaliação, churn, etc.). Com alunos que deram churn mas ainda estão vinculados, os alertas se acumulam indefinidamente — resultando em 199 alertas impossíveis de gerenciar.

Não existe nenhum mecanismo para dispensar/excluir alertas nem para filtrar alunos inativos/churn.

## Plano de Correção

### 1. Criar tabela `dismissed_alerts` no banco

Armazena alertas que o especialista dispensou manualmente:
```sql
CREATE TABLE dismissed_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL,
  alert_key TEXT NOT NULL,        -- ex: "no-plan-<student_id>"
  student_id UUID NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(specialist_id, alert_key)
);
ALTER TABLE dismissed_alerts ENABLE ROW LEVEL SECURITY;
-- RLS: specialists manage own
```

### 2. Filtrar alunos churned automaticamente

No `useProactiveAlerts.ts`:
- Buscar `profiles.status` e ignorar alunos com `status = 'churned'` ou `status = 'cancelado'`
- Buscar `dismissed_alerts` do especialista e excluir alertas com chave correspondente
- Isso já vai reduzir drasticamente o número de alertas

### 3. Adicionar botão "Dispensar" em cada alerta

No `EspecialistaDashboard.tsx`:
- Adicionar ícone `X` em cada linha de alerta
- Ao clicar, inserir na tabela `dismissed_alerts` e invalidar o cache
- Adicionar botão "Restaurar alertas dispensados" para desfazer

### 4. Agrupar alertas por aluno (simplificação visual)

Em vez de listar 5 alertas separados para o mesmo aluno, agrupar:
- Mostrar **1 linha por aluno** com badge do número de pendências
- Expandir ao clicar para ver os detalhes
- Isso transforma 199 linhas em ~30-40 linhas (uma por aluno)

### 5. Adicionar ação "Dispensar todos do aluno"

Para alunos que deram churn:
- Botão "Dispensar todos" que insere todas as chaves de alerta daquele aluno na tabela `dismissed_alerts` de uma vez

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| **Migration SQL** | Criar tabela `dismissed_alerts` com RLS |
| `src/hooks/useProactiveAlerts.ts` | Filtrar churned + buscar dismissed_alerts |
| `src/pages/especialista/EspecialistaDashboard.tsx` | Agrupar por aluno, botão dispensar, restaurar |

## Resultado esperado

- Alunos churned não geram mais alertas
- Especialista pode dispensar alertas individualmente ou por aluno
- Visualização agrupada por aluno reduz ruído visual
- Contador reflete apenas alertas ativos e relevantes

