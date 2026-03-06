/**
 * simulate-webhook.ts
 * Use este script para simular uma chamada ao webhook do Asaas localmente ou em ambiente de teste.
 * 
 * Como usar:
 * deno run --allow-net simulate-webhook.ts
 */

const EDGE_FUNCTION_URL = "http://localhost:54321/functions/v1/asaas-webhook"; // Altere se necessário
const WEBHOOK_TOKEN = "seu_token_aqui"; // O mesmo definido em ASAAS_WEBHOOK_TOKEN

const payload = {
    event: "PAYMENT_CONFIRMED",
    payment: {
        id: `pay_test_${Date.now()}`,
        customer: "cus_test_123",
        value: 150.00,
    }
};

async function test() {
    console.log("🚀 Iniciando simulação de webhook...");

    try {
        const res = await fetch(EDGE_FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "asaas-access-token": WEBHOOK_TOKEN,
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        console.log("✅ Resposta do servidor:", res.status);
        console.log(JSON.stringify(data, null, 2));

        if (res.status === 200) {
            console.log("📝 Webhook processado (Note: Pode falhar no lookup do Asaas se o customer não existir)");
        }
    } catch (err) {
        console.error("❌ Erro ao conectar na Edge Function:", err.message);
    }
}

test();
