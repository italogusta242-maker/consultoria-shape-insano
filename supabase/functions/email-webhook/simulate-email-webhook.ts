/**
 * simulate-email-webhook.ts
 * Script para simular o recebimento de eventos da Brevo (ex-Sendinblue).
 * 
 * Uso:
 * deno run --allow-net simulate-email-webhook.ts
 */

const EDGE_FUNCTION_URL = "http://localhost:54321/functions/v1/email-webhook";
const WEBHOOK_SECRET = "sua_senha_secreta_aqui"; // Opcional, match com BREVO_WEBHOOK_SECRET

// Payload simulando o evento "opened" da Brevo contendo a tag do invite
const payload = {
    event: "opened",
    email: "aluno.teste@examplo.com",
    id: 123456,
    date: new Date().toISOString(),
    ts: Math.floor(Date.now() / 1000),
    "message-id": "<test-message-id@domain.com>",
    ts_event: Math.floor(Date.now() / 1000),
    subject: "Shape Insano - Acesso Liberado",
    tags: ["invite:123e4567-e89b-12d3-a456-426614174000", "onboarding"],
};

async function test() {
    console.log("🚀 Iniciando simulação do webhook da Brevo...");

    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        // Se você configurou BREVO_WEBHOOK_SECRET, envie no header (x-brevo-token é o padrão não oficial, ou authorization)
        if (WEBHOOK_SECRET && WEBHOOK_SECRET !== "sua_senha_secreta_aqui") {
            headers["authorization"] = WEBHOOK_SECRET;
        }

        const res = await fetch(EDGE_FUNCTION_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        console.log("✅ Status HTTP:", res.status);

        try {
            const data = JSON.parse(text);
            console.log("📦 Resposta Parsed:", JSON.stringify(data, null, 2));
        } catch {
            console.log("📦 Resposta Raw:", text);
        }

        if (res.status === 200) {
            console.log("📝 Webhook da Brevo processado com sucesso!");
        } else if (res.status === 401) {
            console.error("❌ Erro 401: Token inválido ou ausente no header Authorization/x-brevo-token.");
        }

    } catch (err: any) {
        console.error("❌ Erro ao conectar na Edge Function:", err.message);
    }
}

test();
