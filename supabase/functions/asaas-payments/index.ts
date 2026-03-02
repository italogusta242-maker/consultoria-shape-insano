import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getAsaasBaseUrl(apiKey: string): string {
  return apiKey.startsWith("$aact_hmlg_") ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
}

// Rate limiting per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

/** Mask sensitive fields for logging */
function maskLog(obj: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...obj };
  const sensitiveKeys = ["creditCard", "credit_card", "ccv", "number", "access_token", "token", "password"];
  for (const key of Object.keys(masked)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      masked[key] = "***REDACTED***";
    }
  }
  return masked;
}

interface PaymentRequest {
  action: "create_payment" | "create_subscription" | "check_status" | "admin_create_charge" | "closer_create_charge";
  idempotency_key?: string;
  name?: string;
  email?: string;
  cpf?: string;
  value?: number;
  billing_type?: "PIX" | "CREDIT_CARD";
  description?: string;
  due_date?: string;
  installment_count?: number;
  credit_card?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  credit_card_holder_info?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string;
    phone: string;
    mobilePhone: string;
  };
  payment_id?: string;
  // Admin charge fields
  plan_id?: string;
  student_id?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function asaasRequest(method: string, endpoint: string, apiKey: string, payload?: unknown) {
  const baseUrl = getAsaasBaseUrl(apiKey);
  const url = `${baseUrl}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      "access_token": apiKey,
      "Content-Type": "application/json",
      "User-Agent": "ShapeInsano/1.0.0",
    },
  };
  if (payload && method === "POST") {
    options.body = JSON.stringify(payload);
  }

  console.log(`[asaas] ${method} ${endpoint}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    
    const raw = await res.text();

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error(`[asaas] Non-JSON response from ${endpoint}:`, raw.substring(0, 200));
      throw new Error(`Asaas returned non-JSON response (status ${res.status})`);
    }

    if (!res.ok) {
      console.error(`[asaas] Error ${res.status} on ${endpoint}:`, JSON.stringify(data?.errors || "Unknown error"));
      throw new Error(data?.errors?.[0]?.description || `Asaas API error ${res.status}`);
    }
    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as Error).name === "AbortError") {
      console.error(`[asaas] Request timeout on ${endpoint}`);
      throw new Error("Asaas API timeout - tente novamente");
    }
    throw err;
  }
}

async function getPixQrCodeWithRetry(paymentId: string, apiKey: string, maxRetries = 3): Promise<{ encodedImage: string; payload: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sleep(attempt === 1 ? 1500 : 2000);
      const pixRes = await asaasRequest("GET", `/payments/${paymentId}/pixQrCode`, apiKey);

      if (!pixRes.payload || !pixRes.encodedImage) {
        console.warn(`[asaas] QR Code attempt ${attempt}: payload or image missing, retrying...`);
        continue;
      }

      let cleanPayload = String(pixRes.payload).trim();
      if (cleanPayload.startsWith("https://") || cleanPayload.startsWith("http://")) {
        cleanPayload = cleanPayload.replace(/^https?:\/\//, "");
      }

      console.log(`[asaas] QR Code retrieved on attempt ${attempt}, payload length: ${cleanPayload.length}`);
      return { encodedImage: pixRes.encodedImage, payload: cleanPayload };
    } catch (err: unknown) {
      console.warn(`[asaas] QR Code attempt ${attempt} failed:`, (err as Error).message);
      if (attempt === maxRetries) throw err;
    }
  }
  throw new Error("Falha ao gerar QR Code PIX após múltiplas tentativas");
}

function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false; // all same digits
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(clean[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(clean[10]);
}

async function getOrCreateCustomer(name: string, email: string, cpf: string, apiKey: string): Promise<string> {
  const searchRes = await asaasRequest("GET", `/customers?cpfCnpj=${cpf}`, apiKey);
  if (searchRes.data && searchRes.data.length > 0) {
    return searchRes.data[0].id;
  }
  const newCustomer = await asaasRequest("POST", "/customers", apiKey, { name, email, cpfCnpj: cpf });
  return newCustomer.id;
}

function buildChargeEmailHtml(
  name: string,
  planName: string,
  value: number,
  billingType: string,
  pixPayload?: string,
  pixImage?: string,
  paymentUrl?: string
): string {
  const formattedValue = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  
  const pixSection = billingType === "PIX" && pixPayload ? `
    <tr><td style="padding:24px;background:#0d0d0d;border:1px solid #333;border-radius:12px;margin-top:16px;">
      <p style="margin:0 0 12px;color:#FBB707;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;text-align:center;">
        Código PIX Copia e Cola
      </p>
      <p style="margin:0;padding:12px;background:#1a1a1a;border:1px solid #444;border-radius:8px;color:#fff;font-size:11px;word-break:break-all;text-align:center;">
        ${pixPayload}
      </p>
      ${pixImage ? `<div style="text-align:center;margin-top:16px;"><img src="data:image/png;base64,${pixImage}" alt="QR Code PIX" width="200" style="border-radius:8px;" /></div>` : ""}
    </td></tr>` : "";

  const paymentLinkSection = paymentUrl ? `
    <tr><td style="padding:24px 0;text-align:center;">
      <a href="${paymentUrl}" target="_blank" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#FF6B00,#FBB707);color:#000;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.5px;">
        PAGAR AGORA
      </a>
      <p style="margin:12px 0 0;color:#888;font-size:12px;">Clique para escolher a forma de pagamento</p>
    </td></tr>` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0a0a0a;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
  <tr><td style="padding:0 0 32px;">
    <div style="height:2px;background:linear-gradient(90deg,transparent,#FF6B00,#FBB707,#FF6B00,transparent);"></div>
  </td></tr>
  <tr><td style="background:linear-gradient(180deg,#1a1a1a 0%,#111111 100%);border-radius:16px;border:1px solid #2a2a2a;padding:40px 32px;">
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;text-align:center;background:linear-gradient(135deg,#FF6B00,#FBB707);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
      💳 Nova Cobrança Gerada
    </h1>
    <p style="margin:0 0 24px;color:#a0a0a0;font-size:15px;text-align:center;line-height:1.5;">
      Fala, <strong style="color:#ffffff;">${name}</strong>! Uma cobrança foi gerada para você.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0d;border:1px solid #333;border-radius:12px;margin:0 0 24px;">
    <tr><td style="padding:24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:14px;">Plano:</td>
          <td style="padding:8px 0;color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${planName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:14px;border-top:1px solid #222;">Valor:</td>
          <td style="padding:8px 0;color:#FBB707;font-size:18px;font-weight:700;border-top:1px solid #222;text-align:right;">${formattedValue}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:14px;border-top:1px solid #222;">Método:</td>
          <td style="padding:8px 0;color:#ffffff;font-size:14px;font-weight:600;border-top:1px solid #222;text-align:right;">${billingType === "PIX" ? "PIX" : "Cartão de Crédito"}</td>
        </tr>
      </table>
    </td></tr>
    </table>
    ${paymentLinkSection}
    ${pixSection}
  </td></tr>
  <tr><td style="padding:32px 0 0;text-align:center;">
    <p style="margin:0;color:#555;font-size:11px;">© 2026 <strong style="color:#FF6B00;">Shape Insano</strong>. Todos os direitos reservados.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth Check: require authenticated user ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Rate Limiting ---
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || claimsData.claims.sub || "unknown";
    if (isRateLimited(clientIp)) {
      return new Response(JSON.stringify({ error: "Too many requests. Try again in 1 minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      throw new Error("ASAAS_API_KEY not configured");
    }

    const body: PaymentRequest = await req.json();
    console.log("[asaas-payments] Action:", body.action, "User:", claimsData.claims.sub);

    // --- Idempotency Check ---
    if (body.idempotency_key && (body.action === "create_payment" || body.action === "create_subscription" || body.action === "admin_create_charge" || body.action === "closer_create_charge")) {
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: existingKey } = await supabaseAdmin
        .from("idempotency_keys")
        .select("response")
        .eq("key", body.idempotency_key)
        .maybeSingle();

      if (existingKey) {
        console.log("[asaas-payments] Duplicate request detected:", body.idempotency_key);
        return new Response(JSON.stringify(existingKey.response || { status: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === CHECK STATUS ===
    if (body.action === "check_status") {
      if (!body.payment_id) {
        return new Response(JSON.stringify({ error: "payment_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payment = await asaasRequest("GET", `/payments/${body.payment_id}`, ASAAS_API_KEY);
      return new Response(JSON.stringify({ status: "success", payment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ADMIN CREATE CHARGE ===
    if (body.action === "admin_create_charge") {
      // Verify admin role
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: roleCheck } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", claimsData.claims.sub)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleCheck) {
        return new Response(JSON.stringify({ error: "Apenas administradores podem gerar cobranças" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!body.student_id || !body.plan_id || !body.billing_type) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios: student_id, plan_id, billing_type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch student profile
      const { data: student, error: studentErr } = await supabaseAdmin
        .from("profiles")
        .select("nome, email, cpf")
        .eq("id", body.student_id)
        .single();

      if (studentErr || !student) {
        return new Response(JSON.stringify({ error: "Aluno não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!student.email || !student.cpf) {
        return new Response(JSON.stringify({ error: "Aluno sem e-mail ou CPF cadastrado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch plan
      const { data: plan, error: planErr } = await supabaseAdmin
        .from("subscription_plans")
        .select("name, price, duration_months, billing_type, description")
        .eq("id", body.plan_id)
        .single();

      if (planErr || !plan) {
        return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const studentName = student.nome || student.email.split("@")[0];
      const studentEmail = student.email;
      const studentCpf = student.cpf.replace(/\D/g, "");

      if (!isValidCpf(studentCpf)) {
        return new Response(JSON.stringify({ error: "CPF do aluno é inválido. Verifique o cadastro." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create/get Asaas customer
      const customerId = await getOrCreateCustomer(studentName, studentEmail, studentCpf, ASAAS_API_KEY);
      console.log("[asaas-payments] Admin charge - Customer ID:", customerId);

      const dueDate = body.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const paymentPayload: Record<string, unknown> = {
        customer: customerId,
        billingType: body.billing_type,
        value: plan.price,
        dueDate: dueDate,
        description: plan.description || `${plan.name} - Shape Insano`,
      };

      console.log("[asaas-payments] Admin charge payload:", JSON.stringify(maskLog(paymentPayload)));

      const paymentRes = await asaasRequest("POST", "/payments", ASAAS_API_KEY, paymentPayload);
      console.log("[asaas-payments] Admin charge created:", paymentRes.id, "status:", paymentRes.status);

      let pixData: { encodedImage: string; payload: string } | null = null;
      if (body.billing_type === "PIX") {
        pixData = await getPixQrCodeWithRetry(paymentRes.id, ASAAS_API_KEY);
      }

      // Save to invites table
      const { data: invite, error: inviteErr } = await supabaseAdmin
        .from("invites")
        .insert({
          email: studentEmail.toLowerCase(),
          name: studentName,
          cpf: studentCpf,
          plan_value: plan.price,
          status: "pending",
          payment_status: "pending",
          created_by: claimsData.claims.sub,
        })
        .select("id")
        .single();

      if (inviteErr) {
        console.error("[asaas-payments] Invite insert error:", inviteErr);
      } else {
        console.log("[asaas-payments] Invite created:", invite.id);
      }

      // Send charge email via Gmail SMTP
      try {
        const adminPaymentUrl = paymentRes.invoiceUrl || paymentRes.bankSlipUrl || null;
        const htmlContent = buildChargeEmailHtml(
          studentName,
          plan.name,
          plan.price,
          body.billing_type,
          pixData?.payload,
          pixData?.encodedImage,
          adminPaymentUrl
        );

        const result = await sendEmail({
          to: studentEmail,
          toName: studentName,
          subject: `💳 Cobrança Shape Insano - ${plan.name}`,
          htmlContent,
          tags: invite?.id ? [`invite:${invite.id}`] : [],
        });

        if (!result.ok) {
          console.error("[asaas-payments] Email error:", result.error);
        } else {
          console.log("[asaas-payments] Charge email sent to:", studentEmail);
        }
      } catch (emailErr) {
        console.error("[asaas-payments] Email send error:", emailErr);
      }

      // Store idempotency key
      if (body.idempotency_key) {
        try {
          await supabaseAdmin.from("idempotency_keys").insert({
            key: body.idempotency_key,
            response: { status: "success", payment_id: paymentRes.id, invite_id: invite?.id },
          });
        } catch { /* Don't fail if idempotency insert fails */ }
      }

      const responseBody: Record<string, unknown> = {
        status: "success",
        payment: paymentRes,
        invite_id: invite?.id,
      };
      if (pixData) responseBody.pix = pixData;

      return new Response(JSON.stringify(responseBody), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CLOSER CREATE CHARGE ===
    if (body.action === "closer_create_charge") {
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: roleCheck } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", claimsData.claims.sub)
        .in("role", ["closer", "admin"])
        .limit(1);

      if (!roleCheck || roleCheck.length === 0) {
        return new Response(JSON.stringify({ error: "Apenas closers ou admins podem gerar cobranças" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!body.name || !body.email || !body.cpf || !body.plan_id) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios: name, email, cpf, plan_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch plan
      const { data: plan, error: planErr } = await supabaseAdmin
        .from("subscription_plans")
        .select("name, price, duration_months, billing_type, payment_method, max_installments, description")
        .eq("id", body.plan_id)
        .eq("active", true)
        .single();

      if (planErr || !plan) {
        return new Response(JSON.stringify({ error: "Plano não encontrado ou inativo" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanCpf = body.cpf.replace(/\D/g, "");
      const customerName = body.name;
      const customerEmail = body.email.trim().toLowerCase();

      if (!isValidCpf(cleanCpf)) {
        return new Response(JSON.stringify({ error: "CPF informado é inválido. Verifique os dados." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create/get Asaas customer
      const customerId = await getOrCreateCustomer(customerName, customerEmail, cleanCpf, ASAAS_API_KEY);
      console.log("[asaas-payments] Closer charge - Customer ID:", customerId);

      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const billingType = plan.billing_type === "recurring" ? "CREDIT_CARD" : (plan.payment_method || "PIX");

      let paymentRes: any;
      let pixData: { encodedImage: string; payload: string } | null = null;
      let invoiceUrl: string | null = null;

      if (plan.billing_type === "recurring") {
        // Create subscription (without credit card - generates payment link)
        const subPayload: Record<string, unknown> = {
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: plan.price,
          nextDueDate: dueDate,
          cycle: "MONTHLY",
          description: plan.description || `${plan.name} - Shape Insano`,
        };
        paymentRes = await asaasRequest("POST", "/subscriptions", ASAAS_API_KEY, subPayload);
        console.log("[asaas-payments] Closer subscription created:", paymentRes.id);

        // Fetch the first payment of this subscription to get invoiceUrl
        try {
          await sleep(2000);
          const paymentsRes = await asaasRequest("GET", `/payments?subscription=${paymentRes.id}&limit=1`, ASAAS_API_KEY);
          if (paymentsRes.data && paymentsRes.data.length > 0) {
            const firstPayment = paymentsRes.data[0];
            invoiceUrl = firstPayment.invoiceUrl || firstPayment.bankSlipUrl || null;
            console.log("[asaas-payments] Subscription first payment invoiceUrl:", invoiceUrl);
          } else {
            console.warn("[asaas-payments] No payments found for subscription yet");
          }
      } catch (subPayErr: unknown) {
          console.error("[asaas-payments] Error fetching subscription payment:", (subPayErr as Error).message);
        }
      } else if (billingType === "CREDIT_CARD" && (plan.max_installments || 1) > 1) {
        // Use Payment Links API so the customer can CHOOSE installments (1x up to max)
        const linkPayload: Record<string, unknown> = {
          name: plan.name,
          description: plan.description || `${plan.name} - Shape Insano`,
          value: plan.price,
          billingType: "CREDIT_CARD",
          chargeType: "INSTALLMENT",
          maxInstallmentCount: plan.max_installments,
          notificationEnabled: true,
          dueDateLimitDays: 7,
        };

        paymentRes = await asaasRequest("POST", "/paymentLinks", ASAAS_API_KEY, linkPayload);
        console.log("[asaas-payments] Closer payment link created:", paymentRes.id);
        invoiceUrl = paymentRes.url || null;
      } else {
        // Create one-time payment (PIX or single credit card charge)
        const paymentPayload: Record<string, unknown> = {
          customer: customerId,
          billingType: billingType,
          value: plan.price,
          dueDate: dueDate,
          description: plan.description || `${plan.name} - Shape Insano`,
        };

        paymentRes = await asaasRequest("POST", "/payments", ASAAS_API_KEY, paymentPayload);
        console.log("[asaas-payments] Closer payment created:", paymentRes.id, "status:", paymentRes.status);

        if (billingType === "PIX") {
          pixData = await getPixQrCodeWithRetry(paymentRes.id, ASAAS_API_KEY);
        }

        invoiceUrl = paymentRes.invoiceUrl || paymentRes.bankSlipUrl || null;
      }

      // Delete any previous expired/cancelled invites for same email+closer to avoid clutter
      await supabaseAdmin
        .from("invites")
        .delete()
        .eq("email", customerEmail)
        .eq("created_by", claimsData.claims.sub)
        .in("status", ["expired"]);

      const finalInvoiceUrl = invoiceUrl || paymentRes.url || paymentRes.invoiceUrl || null;

      // Save invite
      const { data: invite, error: inviteErr } = await supabaseAdmin
        .from("invites")
        .insert({
          email: customerEmail,
          name: customerName,
          cpf: cleanCpf,
          plan_value: plan.price,
          status: "pending",
          payment_status: "pending",
          created_by: claimsData.claims.sub,
          subscription_plan_id: body.plan_id,
          invoice_url: finalInvoiceUrl,
        })
        .select("id")
        .single();

      if (inviteErr) {
        console.error("[asaas-payments] Invite insert error:", inviteErr);
      }

      // Send charge email via Gmail SMTP
      try {
        const closerPaymentUrl = invoiceUrl || paymentRes.url || paymentRes.invoiceUrl || null;
        const htmlContent = buildChargeEmailHtml(
          customerName,
          plan.name,
          plan.price,
          billingType,
          pixData?.payload,
          pixData?.encodedImage,
          closerPaymentUrl
        );

        const result = await sendEmail({
          to: customerEmail,
          toName: customerName,
          subject: `💳 Cobrança Shape Insano - ${plan.name}`,
          htmlContent,
          tags: invite?.id ? [`invite:${invite.id}`] : [],
        });

        if (result.ok) {
          console.log("[asaas-payments] Closer charge email sent to:", customerEmail);
        } else {
          console.error("[asaas-payments] Email error:", result.error);
        }
      } catch (emailErr) {
        console.error("[asaas-payments] Email error:", emailErr);
      }

      // Store idempotency
      if (body.idempotency_key) {
        try {
          await supabaseAdmin.from("idempotency_keys").insert({
            key: body.idempotency_key,
            response: { status: "success", payment_id: paymentRes.id, invite_id: invite?.id },
          });
        } catch { /* ignore */ }
      }

      const responseBody: Record<string, unknown> = {
        status: "success",
        payment: paymentRes,
        invite_id: invite?.id,
        invoice_url: invoiceUrl || paymentRes.invoiceUrl || null,
        plan_name: plan.name,
        billing_type: billingType,
      };
      if (pixData) responseBody.pix = pixData;

      return new Response(JSON.stringify(responseBody), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CREATE PAYMENT ===
    if (body.action === "create_payment") {
      if (!body.name || !body.email || !body.cpf || !body.value || !body.billing_type) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios: name, email, cpf, value, billing_type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.value < 5) {
        return new Response(JSON.stringify({ error: "Valor mínimo: R$ 5,00" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customerId = await getOrCreateCustomer(body.name, body.email, body.cpf, ASAAS_API_KEY);
      console.log("[asaas-payments] Customer ID:", customerId);

      const dueDate = body.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const paymentPayload: Record<string, unknown> = {
        customer: customerId,
        billingType: body.billing_type,
        value: body.value,
        dueDate: dueDate,
        description: body.description || "Consultoria Shape Insano",
      };

      if (body.billing_type === "CREDIT_CARD") {
        if (!body.credit_card || !body.credit_card_holder_info) {
          return new Response(JSON.stringify({ error: "credit_card and credit_card_holder_info are required for CREDIT_CARD" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        paymentPayload.creditCard = {
          holderName: body.credit_card.holderName,
          number: String(body.credit_card.number).replace(/\D/g, ""),
          expiryMonth: String(body.credit_card.expiryMonth).padStart(2, "0"),
          expiryYear: String(body.credit_card.expiryYear),
          ccv: String(body.credit_card.ccv),
        };
        paymentPayload.creditCardHolderInfo = {
          name: body.credit_card_holder_info.name,
          email: body.credit_card_holder_info.email,
          cpfCnpj: String(body.credit_card_holder_info.cpfCnpj).replace(/\D/g, ""),
          postalCode: String(body.credit_card_holder_info.postalCode).replace(/\D/g, ""),
          addressNumber: String(body.credit_card_holder_info.addressNumber),
          phone: String(body.credit_card_holder_info.phone).replace(/\D/g, ""),
          mobilePhone: String(body.credit_card_holder_info.mobilePhone || body.credit_card_holder_info.phone).replace(/\D/g, ""),
        };

        if (body.installment_count && body.installment_count > 1) {
          paymentPayload.installmentCount = Number(body.installment_count);
          paymentPayload.installmentValue = Math.round((Number(body.value) / Number(body.installment_count)) * 100) / 100;
        }
      }

      console.log("[asaas-payments] Payment payload:", JSON.stringify(maskLog(paymentPayload)));

      const paymentRes = await asaasRequest("POST", "/payments", ASAAS_API_KEY, paymentPayload);
      console.log("[asaas-payments] Payment created:", paymentRes.id, "status:", paymentRes.status);

      let responseBody: Record<string, unknown> = { status: "success", payment: paymentRes };

      if (body.billing_type === "PIX") {
        const pixData = await getPixQrCodeWithRetry(paymentRes.id, ASAAS_API_KEY);
        responseBody.pix = pixData;
      }

      if (body.idempotency_key) {
        try {
          const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          await supabaseAdmin.from("idempotency_keys").insert({
            key: body.idempotency_key,
            response: { status: "success", payment_id: paymentRes.id },
          });
        } catch { /* Don't fail if idempotency insert fails */ }
      }

      return new Response(JSON.stringify(responseBody), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CREATE SUBSCRIPTION ===
    if (body.action === "create_subscription") {
      if (!body.name || !body.email || !body.cpf || !body.value || !body.billing_type) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios: name, email, cpf, value, billing_type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!body.credit_card || !body.credit_card_holder_info) {
        return new Response(JSON.stringify({ error: "credit_card and credit_card_holder_info are required for subscription" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customerId = await getOrCreateCustomer(body.name, body.email, body.cpf, ASAAS_API_KEY);
      console.log("[asaas-payments] Subscription Customer ID:", customerId);

      const nextDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const subscriptionPayload: Record<string, unknown> = {
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: body.value,
        nextDueDate: nextDue,
        cycle: "MONTHLY",
        description: body.description || "Assinatura Recorrente - Shape Insano",
        creditCard: {
          holderName: body.credit_card.holderName,
          number: String(body.credit_card.number).replace(/\D/g, ""),
          expiryMonth: String(body.credit_card.expiryMonth).padStart(2, "0"),
          expiryYear: String(body.credit_card.expiryYear),
          ccv: String(body.credit_card.ccv),
        },
        creditCardHolderInfo: {
          name: body.credit_card_holder_info.name,
          email: body.credit_card_holder_info.email,
          cpfCnpj: String(body.credit_card_holder_info.cpfCnpj).replace(/\D/g, ""),
          postalCode: String(body.credit_card_holder_info.postalCode).replace(/\D/g, ""),
          addressNumber: String(body.credit_card_holder_info.addressNumber),
          phone: String(body.credit_card_holder_info.phone).replace(/\D/g, ""),
          mobilePhone: String(body.credit_card_holder_info.mobilePhone || body.credit_card_holder_info.phone).replace(/\D/g, ""),
        },
      };

      console.log("[asaas-payments] Subscription payload:", JSON.stringify(maskLog(subscriptionPayload)));

      const subRes = await asaasRequest("POST", "/subscriptions", ASAAS_API_KEY, subscriptionPayload);
      console.log("[asaas-payments] Subscription created:", subRes.id, "status:", subRes.status);

      if (body.idempotency_key) {
        try {
          const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          await supabaseAdmin.from("idempotency_keys").insert({
            key: body.idempotency_key,
            response: { status: "success", subscription_id: subRes.id },
          });
        } catch { /* Don't fail if idempotency insert fails */ }
      }

      return new Response(JSON.stringify({ status: "success", subscription: subRes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("[asaas-payments] Error:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
