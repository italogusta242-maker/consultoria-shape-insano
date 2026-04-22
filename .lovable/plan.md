

## Dois bugs distintos identificados

### Bug 1 — Fotos da reavaliação não aparecem para o especialista (afeta TODOS desde 14/abr)

**Confirmado no banco:** todas as 6 reavaliações enviadas a partir de 14/abr têm os campos `foto_frente`, `foto_costas`, `foto_lado_direito`, `foto_lado_esquerdo`, `foto_perfil_lado` como `NULL`.

**Confirmado no storage:** os arquivos das fotos **estão lá**, no caminho correto: `anamnese-photos/{user_id}/monthly/{assessment_id}/frente.jpg` etc. Ou seja, o upload funciona, o que falha é o `UPDATE` que grava a URL pública nas colunas da `monthly_assessments` depois do upload.

**Causa:** o fluxo em `src/lib/submitMonthlyAssessment.ts` faz primeiro `INSERT` da reavaliação, depois sobe as fotos, depois faz `UPDATE` das colunas `foto_*` com as URLs. Esse `UPDATE` está silenciosamente falhando (provavelmente por sessão expirando entre as etapas, especialmente em mobile lento), e o código apenas loga o erro sem tentar de novo nem registrar nada visível ao usuário.

**Correção:**
1. Em `submitMonthlyAssessment.ts`, em vez de `INSERT` vazio + `UPDATE` no fim, mudar para:
   - Subir todas as fotos primeiro (gerando URLs).
   - Fazer um único `INSERT` já com todas as colunas `foto_*` preenchidas.
   - Manter o rollback caso TODOS os uploads falhem.
2. Refrescar a sessão (`refreshSession`) também imediatamente antes do INSERT, não só no início.
3. Logar erro do INSERT/UPDATE de forma visível (toast) em vez de só `console.error`.

**Recuperação dos dados existentes:** as fotos das 6 reavaliações órfãs ainda estão no bucket. Vou rodar uma migração de dados (script único) que percorre cada `monthly_assessment` recente sem fotos, lista os arquivos em `anamnese-photos/{user_id}/monthly/{assessment_id}/` e preenche os campos `foto_*` com as URLs públicas. Isso vai restaurar as fotos para o especialista sem precisar pedir nada aos alunos.

### Bug 2 — Nicolas Rocha não consegue abrir a reavaliação

**Causa:** o `NotificationCenter` (sino) só faz navegação para notificações de `type === "chat"`. Para `type === "anamnese_request"` ele apenas marca como lida e fica parado — nenhum redirecionamento. Como o `next_anamnese_due` do Nicolas é 26/abr (futuro), o banner amarelo "PREENCHER AGORA" também não aparece pra ele. Resultado: ele vê a notificação na sininha, clica, e nada acontece.

Isso afeta qualquer aluno cuja anamnese foi solicitada manualmente pelo especialista (sem ter atingido a data de vencimento automática).

**Correção em `src/components/NotificationCenter.tsx`:**
- Adicionar roteamento por tipo:
  - `anamnese_request` → fecha o sheet e navega para `/reavaliacao`.
  - `plan` / `new_plan` → navega para `/treinos` ou `/dieta` conforme `metadata.plan_type`.
  - mantém o `chat` atual.
- Isso já é o comportamento documentado em memória (`mem://features/notifications/routing`) e estava regredido.

**Reforço opcional, mas recomendado:** quando o especialista solicitar anamnese manualmente em `EspecialistaAlunos.tsx`, além de criar a notificação, também atualizar `profiles.next_anamnese_due` para a data de hoje, para que o banner amarelo grande também apareça para o aluno (caminho redundante, à prova de erro).

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/submitMonthlyAssessment.ts` | Subir fotos antes do INSERT; INSERT único com URLs; refresh de sessão; toast em erro |
| `src/components/NotificationCenter.tsx` | Roteamento por tipo (anamnese_request → /reavaliacao, plan → /treinos|/dieta) |
| `src/pages/especialista/EspecialistaAlunos.tsx` | Ao solicitar anamnese, também setar `next_anamnese_due = hoje` |
| Script único de recuperação | Repreenche `foto_*` das reavaliações órfãs a partir do storage |

Sem mudanças de schema. Sem mudanças de RLS.

### Validação após implementar

- Aluno abre `/reavaliacao` pela notificação → carrega.
- Aluno envia reavaliação com 5 fotos → no especialista as 5 fotos aparecem imediatamente.
- Reavaliações já enviadas desde 14/abr passam a mostrar as fotos no portal do especialista após o script de recuperação.

