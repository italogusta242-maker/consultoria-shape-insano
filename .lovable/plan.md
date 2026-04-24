## Problema

O usuário relata "Dupla Anamnese" — dois cards/entradas aparecendo ao mesmo tempo para a mesma anamnese. Após investigação, identifiquei **três fontes de duplicação distintas**, todas com o mesmo padrão raiz: lógicas independentes que disparam em paralelo sem uma "fonte única da verdade".

### 1. Timeline de Fotos (o caso do print)

Em `src/lib/photoTimeline.ts`, a função `buildPhotoTimeline` lista **um item separado por registro** na tabela `anamnese`. Como o aluno do print tem 2 registros (24/abril vazio + 26/fevereiro com fotos), aparecem dois cards rotulados igual: "Anamnese". Pior: o de 24/abril mostra **4 quadrados pretos** porque entradas com URL "vazia mas truthy" ou storage inacessível ainda passam o filtro.

### 2. Alertas Proativos do Especialista

Em `src/hooks/useProactiveAlerts.ts`, o mesmo aluno pode gerar até 3 alertas paralelos sobre reavaliação:
- `assessment_overdue` (baseado em "30 dias desde a anamnese inicial")
- `monthly_pending` (baseado em `next_anamnese_due` vencido)
- `monthly_awaiting_review` (assessment já enviado, aguardando análise)

### 3. Banner do Dashboard do Aluno

Já está unificado (existe só `AnamneseRequestAlert`, comentário "MonthlyAnamnesisBanner removed — unified"), mas vou adicionar uma trava de segurança para garantir que não "ressuscite".

## O que fazer

### A. Timeline de Fotos — Single Source of Truth por data

Refatorar `buildPhotoTimeline` para:

1. **Deduplicar por dia**: agrupar todas as fotos do mesmo dia (anamnese + reavaliação) em UMA entrada de timeline. Se o dia tem reavaliação, o rótulo passa a ser "Reavaliação"; senão "Anamnese".
2. **Filtrar entradas vazias**: descartar registros de anamnese sem nenhuma foto realmente carregável (URL não vazia, não claramente quebrada). Eliminar os "quadrados pretos" do print.
3. **Marcar a entrada inicial**: a primeira anamnese histórica ganha um badge "Anamnese Inicial" para diferenciá-la das mensais.

### B. Alertas do Especialista — Prioridade única por aluno

Refatorar a seção "Monthly assessment" em `useProactiveAlerts.ts` para que cada aluno gere **no máximo 1 alerta de reavaliação por vez**, na seguinte ordem de prioridade:

```text
Prioridade 1: monthly_awaiting_review  (atleta cumpriu, especialista precisa revisar)
Prioridade 2: monthly_pending          (atleta atrasou — next_anamnese_due vencido)
Prioridade 3: assessment_overdue       (legado: nunca preencheu nenhuma)
```

Se o aluno cai na Prioridade 1, os outros dois alertas não são gerados. Isso elimina o "card duplicado" no painel do especialista.

### C. Dashboard do Aluno — Trava de unicidade

Em `AnamneseRequestAlert.tsx`, adicionar uma flag `data-anamnese-alert="single"` no elemento raiz e um `useEffect` que detecta se mais de um alerta está montado simultaneamente (defensivo contra regressões futuras). Se detectar, loga warning e renderiza apenas um.

## Arquivos a modificar

- `src/lib/photoTimeline.ts` — agrupamento por dia + filtro de fotos válidas + flag "inicial"
- `src/components/especialista/StudentPhotosPanel.tsx` — exibir badge "Anamnese Inicial" e ajustar contagem na timeline modal
- `src/pages/MinhaEvolucao.tsx` — mesma melhoria visual da timeline
- `src/hooks/useProactiveAlerts.ts` — prioridade única para alertas de reavaliação
- `src/components/AnamneseRequestAlert.tsx` — trava defensiva de instância única

## Resultado esperado

- O print do usuário passa a mostrar **1 entrada de Anamnese** (a inicial real, com fotos visíveis), e a entrada de 24/abril vira corretamente "Reavaliação" (se houver `monthly_assessment`) ou some (se for registro vazio).
- Painel do especialista mostra **1 card** por aluno para reavaliação, com a ação certa: "Revisar", "Cobrar atleta" ou "Solicitar primeira".
- O banner no Dashboard do aluno permanece único (já estava, agora protegido).
