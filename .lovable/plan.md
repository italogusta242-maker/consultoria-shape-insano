

## Diagnóstico: Diogo Moreira dos Santos

### Problema 1 — Banner/popup não aparece
As duas notificações `anamnese_request` do Diogo estão **`read: true`**. O componente `AnamneseRequestAlert` só exibe quando existe uma notificação com `read: false`. Algo marcou essas notificações como lidas (provavelmente ele clicou na notificação no sino, o que marca como lida sem necessariamente preencher o formulário).

**Correção necessária:** O sistema de notificações marca `read: true` ao clicar no sino — mas a lógica do alerta de anamnese depende de `read: false`. Precisamos desacoplar: o alerta deve usar `next_anamnese_due` como fonte de verdade, não o status `read` da notificação.

### Problema 2 — Dois cards de reavaliação
O dashboard tem **dois componentes independentes** que podem aparecer ao mesmo tempo:
1. `AnamneseRequestAlert` — banner amarelo (baseado em notificação não lida)
2. `MonthlyAnamnesisBanner` — card "Nova Anamnese Disponível" (baseado em `next_anamnese_due` vencido **ou** 30+ dias desde última avaliação)

No caso do Diogo, `next_anamnese_due = 22/abr` (futuro), mas a última anamnese/assessment é de fev/mar, então o fallback `daysSinceAnamnese >= 30` ativa o segundo card. E se a notificação estiver não lida, o primeiro também aparece → dois cards.

### Plano de correção

#### 1. Unificar em um único componente de alerta
**Arquivo:** `src/components/AnamneseRequestAlert.tsx`
- Mudar a lógica: verificar `next_anamnese_due <= hoje` no perfil do usuário **OU** notificação `anamnese_request` não lida
- Isso garante que o alerta aparece mesmo que a notificação seja marcada como lida no sino

#### 2. Remover `MonthlyAnamnesisBanner` duplicado
**Arquivo:** `src/pages/Dashboard.tsx`
- Remover o componente `MonthlyAnamnesisBanner` e toda a lógica associada (`lastAssessmentDate`, `daysSinceAnamnese`, `showAnamnese`)
- Manter apenas o `AnamneseRequestAlert` como ponto único de alerta

#### 3. Fix one-time: reenviar notificação do Diogo
- Inserir nova notificação `anamnese_request` com `read: false` e ajustar `next_anamnese_due` para hoje

| Arquivo | Mudança |
|---------|---------|
| `src/components/AnamneseRequestAlert.tsx` | Usar `next_anamnese_due` como fonte de verdade |
| `src/pages/Dashboard.tsx` | Remover `MonthlyAnamnesisBanner` duplicado |
| Migration SQL | Fix Diogo: nova notificação + reset `next_anamnese_due` |

