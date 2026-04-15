

## Rollback na reavaliação quando fotos falham

### Problema
O registro é inserido no banco e o `next_anamnese_due` é atualizado **antes** dos uploads. Se todos falharem, fica um registro fantasma sem fotos e o aluno não consegue refazer.

### Correção

**1. Reordenar o fluxo em `src/lib/submitMonthlyAssessment.ts`**
- Mover a marcação de notificações como lidas e o update do `next_anamnese_due` para **depois** da verificação de fotos
- Após `Promise.all(uploads)`, verificar `Object.keys(photoUpdates).length`:
  - Se **0 fotos** subiram: deletar o registro recém-criado e lançar erro claro
  - Se **algumas** subiram (mas não todas): prosseguir normalmente (upload parcial é aceitável)

```typescript
// Após Promise.all(uploads)
const totalExpected = photoFields.filter(({ key }) => formData[key] instanceof File).length;
if (totalExpected > 0 && Object.keys(photoUpdates).length === 0) {
  await supabase.from("monthly_assessments").delete().eq("id", assessmentId);
  throw new Error("Nenhuma foto foi enviada com sucesso. Verifique sua conexão e tente novamente.");
}

// Só agora marcar notificações como lidas e atualizar next_anamnese_due
```

**2. Migration SQL: permitir DELETE do próprio registro**
A tabela `monthly_assessments` não tem policy de DELETE. Preciso adicionar uma para que o rollback funcione:

```sql
CREATE POLICY "Users delete own monthly assessments"
ON public.monthly_assessments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/lib/submitMonthlyAssessment.ts` | Rollback + reordenar fluxo |
| Migration SQL | Policy de DELETE em `monthly_assessments` |

