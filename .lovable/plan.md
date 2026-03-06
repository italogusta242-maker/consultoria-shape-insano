

## Verification Results

### 1. Secrets Status
Both **ASAAS_WEBHOOK_TOKEN** and **BREVO_API_KEY** are confirmed set in the project secrets. No action needed.

### 2. Edge Function Logs
No logs found for `asaas-webhook`. This means either:
- No webhook events have been received recently
- The function hasn't been triggered yet

### 3. Code Review — `asaas-webhook/index.ts`
The function is well-structured:
- **Token validation** (lines 266-282): Rejects requests if `ASAAS_WEBHOOK_TOKEN` is missing or doesn't match the `asaas-access-token` header
- **ASAAS_API_KEY** check (lines 319-326): Returns 500 if not set
- **Idempotency** via `idempotency_keys` table
- **Auto-provisioning** creates user, sends credentials email via Brevo

### 4. Simulate a Test Webhook
To safely test, I can use the edge function testing tool to send a simulated `PAYMENT_CONFIRMED` event to the deployed function. This will verify:
- Token validation works
- The function processes the event correctly
- Brevo email sending works

### Proposed Plan

1. **Test the webhook endpoint** — Use `curl_edge_functions` to send a test payload with the correct `asaas-access-token` header and a `PAYMENT_CONFIRMED` event with a fake payment ID. This will confirm the function is reachable and the token validation works.

2. **Review logs after test** — Check edge function logs to see if the request was processed or rejected, identifying any 401/500 errors.

3. **Report findings** — Share the results with you so we can determine if anything needs fixing.

> **Note**: The test will use a fake customer ID, so it will fail at the Asaas API customer lookup step (which is expected and safe). This is enough to confirm the webhook pipeline is working up to the external API call.

