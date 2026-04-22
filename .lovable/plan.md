

## Ajustes solicitados

### 1. Categoria "Cardio" some do banco de exercícios

**O que está acontecendo:** existem 17 exercícios cadastrados com `category = 'cardio'` (Esteira, Bike, Elíptico, Pular Corda, etc.), mas todos foram salvos com `muscle_group = 'quadríceps'`. Os filtros e o seletor de "novo exercício" usam exclusivamente o campo `muscle_group`, e o array fixo `MUSCLE_GROUPS` no código não tem "cardio". Resultado: ao filtrar pelas tags ou criar exercício novo, "cardio" não aparece como opção e os 17 cardios ficam escondidos dentro de "quadríceps".

**Correção:**
- Adicionar `"cardio"` no array `MUSCLE_GROUPS` em `src/components/especialista/ExerciseSelector.tsx` e `src/pages/especialista/EspecialistaExercicios.tsx` (vira mais um chip/opção de seleção).
- Ajustar o filtro do `ExerciseSelector` para que, quando "cardio" estiver selecionado, considere `muscle_group = 'cardio'` **OU** `category = 'cardio'`. Assim os 17 exercícios já existentes aparecem imediatamente sem precisar mexer no banco.
- Ao criar um exercício novo escolhendo "Cardio" como grupo, gravar `muscle_group = 'cardio'` e `category = 'cardio'`. Novos exercícios já ficam consistentes.
- Migração leve (opcional, recomendada): atualizar os 17 exercícios existentes para `muscle_group = 'cardio'` e remover esse "ruído" da aba Quadríceps.

### 2. Botão "Novo Treino" dentro do Editor

**O que está acontecendo:** hoje, quando o especialista abre um plano para editar e quer começar do zero, ele precisa apagar exercício por exercício e grupo por grupo manualmente.

**Correção em `TrainingPlanEditor.tsx`:**
- Adicionar um botão "**+ Novo do Zero**" no topo do editor (próximo de "Gerar com IA", "Templates", "Importar PDF").
- Ao clicar, mostra um confirm rápido ("Isso vai descartar o plano atual e começar em branco. Continuar?") e então reseta o draft: 1 grupo único "A - Treino A" vazio, título padrão, sessões 50, campos de análise limpos.
- Como o draft fica salvo no Zustand por aluno, esse botão também mantém um snapshot do estado anterior em memória até o editor fechar, para o "Desfazer" do item 3 funcionar.

### 3. Botão "Desfazer" ao lado de "Salvar"

**O que está acontecendo:** só existe Salvar / Cancelar (fechar). Não há como reverter alterações feitas durante a sessão de edição sem fechar e perder rascunho.

**Correção:**
- Capturar um **snapshot inicial** do plano no momento em que o editor abre (ou no momento em que o "Novo do Zero" é acionado).
- Adicionar botão "**Desfazer alterações**" ao lado do "Salvar" no rodapé, ativo apenas quando o estado atual diverge do snapshot.
- Ao clicar: restaura o snapshot no draft do Zustand. Confirmação leve para evitar clique acidental.

### 4. Pré-visualizar versão antiga sem sobrescrever o treino atual

**O que está acontecendo:** no Histórico de Versões (`PlanVersionTimeline`), o botão "Restaurar esta versão" chama `setGroups(...)` direto no draft, sobrescrevendo o treino atual sem aviso e sem volta. O especialista precisa apenas dar uma olhada na versão antiga para comparar e acaba perdendo o trabalho.

**Correção:**
- Renomear o fluxo do `PlanVersionTimeline` para ter **dois botões** por versão expandida:
  1. **"Pré-visualizar"** (ícone Eye) → abre o `TrainingPreviewModal` já existente passando os dados daquela versão (somente leitura, igual o aluno veria). Não toca no draft atual.
  2. **"Aplicar esta versão"** (ícone RotateCcw) → mostra confirm explícito ("Vai substituir o treino atual pela versão vX. O treino atual ficará disponível como nova versão automaticamente após salvar. Continuar?") e só então sobrescreve.
- Como o `snapshot_training_plan` (trigger) já cria versão automaticamente a cada UPDATE, mesmo se o especialista aplicar e salvar por engano, o estado anterior continua recuperável pelo histórico — mas o aviso explícito evita a confusão atual.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/especialista/ExerciseSelector.tsx` | Adiciona "cardio" no `MUSCLE_GROUPS`; filtro considera `category = 'cardio'`; criação grava também `category` |
| `src/pages/especialista/EspecialistaExercicios.tsx` | Adiciona "cardio" no `MUSCLE_GROUPS` (criação/edição); grava `category` quando aplicável |
| `src/components/especialista/TrainingPlanEditor.tsx` | Botão "Novo do Zero", snapshot inicial, botão "Desfazer alterações" no rodapé, ajuste do `onRestore` para passar pré-visualização e confirmação |
| `src/components/especialista/PlanVersionTimeline.tsx` | Dois botões por versão: "Pré-visualizar" (preview modal) e "Aplicar" (confirm) |
| Migração de dados (1 UPDATE) | Move os 17 cardios de `muscle_group='quadríceps'` para `muscle_group='cardio'` mantendo `category='cardio'` |

Sem mudanças de schema. Sem mudanças de RLS. Sem mexer em comportamento do aluno.

### Resultado esperado

- Aba/chip "Cardio" aparece no seletor e na criação de exercícios — os 17 cardios existentes ficam visíveis lá.
- Botão "Novo do Zero" dentro do editor cria um plano em branco em 1 clique, com confirmação.
- "Desfazer alterações" devolve o editor ao estado de quando foi aberto, sem fechar.
- Clicar em uma versão antiga mostra primeiro a pré-visualização do aluno; só sobrescreve se o especialista confirmar explicitamente "Aplicar".

