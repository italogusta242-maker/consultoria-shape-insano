

## Diagnóstico — Dois problemas do aluno

### 1. "App cobrando anamnese que já respondi 3x"

**Causa raiz**: Quando o aluno submete a reavaliação mensal (`submitMonthlyAssessment.ts`), o sistema:
- Salva o `monthly_assessment` no banco
- Atualiza peso/altura no perfil
- Envia para Google Sheets

Mas **NÃO** faz duas coisas críticas:
- **Não marca as notificações `anamnese_request` como lidas** — o `AnamneseRequestAlert` continua encontrando notificações não lidas e mostrando o banner/modal
- **Não atualiza `next_anamnese_due`** no perfil para +30 dias — então qualquer automação futura continuaria cobrando

Resultado: o aluno preenche, mas o banner continua aparecendo indefinidamente.

### 2. "App trava no descanso e fecha"

**Causa raiz**: O `RestTimer` usa um overlay `fixed inset-0 z-50` com um `setInterval` de 250ms. No mobile:
- Quando o celular bloqueia a tela ou o navegador vai para background, o OS pode suspender/matar a aba
- Ao restaurar, o estado do React é perdido mas o componente tenta re-renderizar sem contexto
- Não há proteção com `wakeLock` API nem persistência do estado do timer

---

## Plano de Correção

### Correção 1 — Marcar notificações como lidas após envio da anamnese

**Arquivo**: `src/lib/submitMonthlyAssessment.ts`

Após a inserção bem-sucedida (após linha 83), adicionar:
```typescript
// Mark all anamnese_request notifications as read
await supabase
  .from("notifications")
  .update({ read: true })
  .eq("user_id", user.id)
  .eq("type", "anamnese_request")
  .eq("read", false);

// Update next_anamnese_due to +30 days
const nextDue = new Date();
nextDue.setDate(nextDue.getDate() + 30);
await supabase
  .from("profiles")
  .update({ next_anamnese_due: nextDue.toISOString().split("T")[0] })
  .eq("id", user.id);
```

### Correção 2 — Proteger o RestTimer contra suspensão do mobile

**Arquivo**: `src/pages/Treinos.tsx` (componente `RestTimer`)

- Implementar **Wake Lock API** para impedir que a tela desligue durante o descanso:
  ```typescript
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then(wl => { wakeLock = wl; }).catch(() => {});
    }
    return () => { wakeLock?.release().catch(() => {}); };
  }, []);
  ```
- Adicionar tratamento de `visibilitychange` para recalcular o tempo restante quando o app volta ao primeiro plano (já existe parcialmente via `startRef.current`, mas verificar que funciona corretamente ao retomar)

### Resumo de alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/lib/submitMonthlyAssessment.ts` | Marca notificações como lidas + atualiza `next_anamnese_due` |
| `src/pages/Treinos.tsx` | Wake Lock API no RestTimer para evitar suspensão no mobile |

