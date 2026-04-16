

## Onde já existe e o que pode ser melhorado

A informação **já existe** no portal do especialista, mas só aparece dentro de um lugar específico:

### Localização atual
**`/especialista/alunos`** → ao clicar em um aluno → aba **"Resumo"** → seção **"Plano / Contrato"** (`StudentResumoContent` em `EspecialistaAlunos.tsx`, linhas 320–403).

Mostra 4 campos quando disponíveis:
- Início Assinatura (de `subscriptions.started_at`)
- Término Assinatura (calculado: `started_at + duration_months` do `subscription_plans`)
- Validade Treino (`training_plans.valid_until`)
- Validade Dieta (`diet_plans.valid_until`)

### O que provavelmente está faltando
Essa info só fica visível depois de abrir o drawer/perfil do aluno. Não aparece:
1. **Na lista/cards de alunos** (`EspecialistaAlunos`) — onde o especialista bate o olho
2. **No header do perfil do aluno** — aparece só rolando até a seção
3. **Na anamnese split view** (`EspecialistaAnamneseSplit`) — onde o especialista edita treino/dieta

### Proposta de mudança

Tornar essas datas mais visíveis em 2 pontos:

**1. Header do perfil do aluno (drawer "Resumo")**
Adicionar um chip/badge compacto no topo do drawer com "Início → Término Assinatura" e dias restantes (ex: `15/03/2026 → 15/03/2027 · 287 dias restantes`). Cor amber se restar < 30 dias.

**2. Card do aluno na listagem**
Pequeno texto abaixo do nome: `Plano: 15/03 → 15/03/27` (formato curto). Aparece só se houver assinatura ativa.

**3. Header do `EspecialistaAnamneseSplit`** (tela onde o especialista edita planos)
Mesma badge compacta com início + término da assinatura, para o especialista saber em que ponto do contrato o aluno está enquanto monta o plano.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/especialista/EspecialistaAlunos.tsx` | Mover/duplicar datas do contrato para o header do drawer; adicionar mini-info no card do aluno |
| `src/pages/especialista/EspecialistaAnamneseSplit.tsx` | Adicionar badge "Assinatura: início → término" no header |

Nenhuma mudança de banco — todos os dados já vêm de `subscriptions` + `subscription_plans`.

### Pergunta antes de seguir
Você quer que eu:
- (A) Apenas torne mais visível onde já existe (header do drawer + card)
- (B) Replique também na tela de edição de planos (`AnamneseSplit`)
- (C) Ambos

