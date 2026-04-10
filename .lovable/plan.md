

## Diagnóstico: Por que o Athos não tem reavaliações salvas

**Fatos confirmados no banco:**
- Athos (`e03682e6...`) tem **0 registros** em `monthly_assessments`
- Notificação `anamnese_request` de 26/mar ainda está `read: false`
- `next_anamnese_due` = 2026-03-24 (vencido há 17 dias)
- Ele tem 1 anamnese inicial (20/mar)

**Conclusão:** Os 3 envios que ele diz ter feito falharam silenciosamente. As causas prováveis são:

1. **Erro no upload de fotos no mobile** — fotos grandes podem exceder timeout ou falhar na rede, e o erro é capturado no catch genérico sem feedback claro
2. **Sessão expirada** — `supabase.auth.getUser()` retorna null se a sessão expirou, e o retorno `{ success: false, error: "Usuário não autenticado" }` pode não ser bem visível como toast no mobile
3. **O toast de erro desaparece rápido** no celular e o aluno não percebe

## Plano de correção — Tornar o submit mais resiliente

### 1. Feedback de erro mais agressivo no submit
**Arquivo:** `src/pages/monthly-assessment/MonthlyAssessment.tsx`
- Se `result.success === false`, além do toast, manter o botão habilitado e mostrar um banner de erro persistente (não apenas toast)
- Adicionar um state `submitError` que exibe uma mensagem vermelha fixa na tela

### 2. Reautenticar antes do submit
**Arquivo:** `src/lib/submitMonthlyAssessment.ts`
- Antes de `getUser()`, chamar `supabase.auth.refreshSession()` para garantir que o token não expirou
- Se mesmo assim falhar, retornar erro mais descritivo

### 3. Reduzir tamanho das fotos antes do upload
**Arquivo:** `src/lib/submitMonthlyAssessment.ts`
- Comprimir imagens (resize para max 1200px, quality 0.8) antes do upload para evitar timeout no mobile
- Isso reduz drasticamente falhas de rede

### 4. Retry automático no upload de fotos
**Arquivo:** `src/lib/submitMonthlyAssessment.ts`
- Se upload falhar, tentar novamente 1x antes de desistir

### 5. Reenviar notificação para o Athos (one-time fix)
- Criar migration para inserir nova `anamnese_request` e resetar `next_anamnese_due` para hoje

| Arquivo | Mudança |
|---------|---------|
| `src/lib/submitMonthlyAssessment.ts` | Refresh session, comprimir fotos, retry upload |
| `src/pages/monthly-assessment/MonthlyAssessment.tsx` | Banner de erro persistente |
| Migration SQL | Reenviar notificação ao Athos |

