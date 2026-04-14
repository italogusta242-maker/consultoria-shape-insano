

## Plano: Inativar aluno + Modo editor-only na tela de anamnese

### Problema
1. **Especialista não consegue inativar um aluno** — não existe botão/ação para mudar o status do aluno para "inativo", cortando seu acesso ao sistema.
2. **Editar treino na visualização do aluno** — o botão "Editar Treino" no card do aluno abre o editor em modal. O usuário quer que funcione igual ao split (abrir o editor inline ou redirecionar para o split).
3. **Split forçado** — ao abrir a anamnese do aluno, sempre aparece split (anamnese + editor). O especialista quer ter a opção de ver **só o editor** em tela cheia, sem o split.

### Alterações

#### 1. Botão "Inativar Aluno" no card/menu do aluno
**Arquivo:** `src/pages/especialista/EspecialistaAlunos.tsx`
- Adicionar item "Inativar Aluno" no `DropdownMenu` ou `StudentSummaryDialog` do aluno
- Ao confirmar, executar `UPDATE profiles SET status = 'inativo' WHERE id = studentId`
- Também adicionar opção inversa "Reativar Aluno" quando o status já for inativo
- Mostrar confirmação antes de executar (dialog ou confirm)

**RLS:** Especialistas já podem ler perfis de alunos vinculados, mas **não podem fazer UPDATE**. Será necessária uma migration para adicionar política de UPDATE limitada (especialista só pode alterar o campo `status` dos alunos vinculados).

**Migration SQL:**
- Criar policy permitindo que especialistas façam UPDATE na coluna `status` de profiles de alunos vinculados via `student_specialists`

#### 2. Redirecionar "Editar Treino" para o split
**Arquivo:** `src/pages/especialista/EspecialistaAlunos.tsx`
- Alterar `handleEditTraining` para navegar para `/especialista/anamnese/{studentId}` (a tela split) ao invés de abrir o editor em modal
- Isso unifica a experiência: sempre editar no split com contexto da anamnese

#### 3. Toggle split/editor-only na tela de anamnese
**Arquivo:** `src/pages/especialista/EspecialistaAnamneseSplit.tsx`
- Adicionar state `viewMode: "split" | "editor-only"`
- Adicionar botão toggle no header: "Expandir Editor" / "Mostrar Anamnese"
- Quando `editor-only`, esconder o painel esquerdo (anamnese) e o editor ocupa 100% da largura
- Quando `split`, manter o layout atual 50/50

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `src/pages/especialista/EspecialistaAlunos.tsx` | Botão inativar/reativar + redirecionar editar treino para split |
| `src/pages/especialista/EspecialistaAnamneseSplit.tsx` | Toggle split vs editor-only |
| Migration SQL | Policy UPDATE para especialistas no campo status de profiles |

