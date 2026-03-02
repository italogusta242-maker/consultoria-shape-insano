

## Plano: Rastreamento de E-mail (Open/Click Tracking) no Painel do Closer

### Contexto
O Closer gera convites que disparam e-mails de cobrança via Brevo. Atualmente não há rastreamento de abertura/clique. O objetivo é adicionar visibilidade em tempo real do funil de vendas.

### Limitação Importante
O provedor de e-mail atual é **Brevo** (não Resend). A Brevo suporta webhooks de eventos (`delivered`, `opened`, `click`) que precisam ser configurados no painel da Brevo apontando para uma Edge Function.

---

### 1. Migração do Banco de Dados (tabela `invites`)

Adicionar 2 colunas à tabela `invites`:
- `email_opened_at` (timestamptz, nullable)
- `payment_link_clicked_at` (timestamptz, nullable)

Habilitar Realtime na tabela `invites`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.invites;
```

O campo `status` já existe e será reutilizado. Os novos estados do funil serão derivados combinando `status`, `payment_status`, `email_opened_at` e `payment_link_clicked_at`.

---

### 2. Edge Function: `email-webhook` (Webhook da Brevo)

Nova Edge Function `email-webhook` que:
- Recebe POST da Brevo com eventos de e-mail
- Valida a origem (opcional: shared secret)
- Para evento `opened`: atualiza `email_opened_at = now()` no invite correspondente
- Para evento `click`: atualiza `payment_link_clicked_at = now()` no invite correspondente
- A identificação do invite será feita via tag/custom header no e-mail (o `invite_id` será enviado como tag na chamada da Brevo)

**Mudança necessária no envio de e-mail** (`asaas-payments` edge function):
- Ao enviar o e-mail de cobrança do closer, incluir o `invite_id` como tag nos headers da API Brevo (campo `tags` ou `headers` do payload)
- Isso permite que o webhook identifique qual invite corresponde ao evento

**Mudança no `_shared/smtp.ts`:**
- Adicionar suporte a campo opcional `tags` no `EmailOptions` e incluí-lo no payload da Brevo

---

### 3. Atualização da UI (CloserDashboard)

Na tabela de convites existente, substituir a coluna "Pagamento" por badges de funil visual:

| Estado | Badge | Cor | Condição |
|--------|-------|-----|----------|
| Enviado | ✉️ Enviado | Cinza | `status=pending`, sem `email_opened_at` |
| Visto | 👀 Visto | Azul | `email_opened_at` preenchido |
| Checkout | 💳 Checkout | Laranja | `payment_link_clicked_at` preenchido |
| Pago | ✅ Pago | Verde | `payment_status=paid` |

Adicionar tempo relativo (ex: "há 5 min") abaixo do badge usando `date-fns.formatDistanceToNow`.

**Realtime**: Adicionar subscription no canal `invites` filtrando por `created_by = user.id` para atualizar badges em tempo real sem reload.

---

### 4. Configuração Manual Necessária (pelo usuário)

Após implementação, o usuário precisará:
1. Acessar o painel da Brevo → Settings → Webhooks
2. Adicionar a URL da Edge Function como endpoint de webhook
3. Selecionar os eventos `opened` e `click`

---

### Arquivos Modificados/Criados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/email-webhook/index.ts` | Criar (webhook Brevo) |
| `supabase/functions/_shared/smtp.ts` | Editar (adicionar tags) |
| `supabase/functions/asaas-payments/index.ts` | Editar (enviar invite_id como tag) |
| `supabase/config.toml` | Editar (adicionar `email-webhook` com `verify_jwt = false`) |
| `src/pages/closer/CloserDashboard.tsx` | Editar (badges de funil + realtime + tempo relativo) |
| Migração SQL | 2 colunas + realtime |

