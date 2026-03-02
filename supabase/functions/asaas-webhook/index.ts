import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/smtp.ts";

// Helper to call Asaas API
async function asaasRequest(method: string, endpoint: string, apiKey: string) {
  const baseUrl = apiKey.includes("$aact_hmlg_") ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
  const url = `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      "access_token": apiKey,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Asaas API error ${res.status}: ${err}`);
  }
  return res.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateSecurePassword(cpf: string | null, email: string): string {
  const cpfClean = (cpf || "").replace(/\D/g, "");
  if (cpfClean.length >= 11) return cpfClean;
  // Fallback: first 6 chars of email + random 4 digits
  const prefix = email.split("@")[0].slice(0, 6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${rand}`;
}

function buildCredentialEmailHtml(name: string, email: string, password: string, accessUrl: string, logoUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bem-vindo ao Shape Insano</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0a0a0a;">
<tr><td align="center" style="padding:40px 16px;">

<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 24px;color:#ffffff;">
    <img src="${logoUrl}" alt="Shape Insano" width="80" style="display:block;border:0;" />
  </td></tr>

  <!-- Divider gold -->
  <tr><td style="padding:0 0 32px;">
    <div style="height:2px;background:linear-gradient(90deg,transparent,#FF6B00,#FBB707,#FF6B00,transparent);"></div>
  </td></tr>

  <!-- Main Card -->
  <tr><td style="background:linear-gradient(180deg,#1a1a1a 0%,#111111 100%);border-radius:16px;border:1px solid #2a2a2a;padding:40px 32px;">

    <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;text-align:center;background:linear-gradient(135deg,#FF6B00,#FBB707);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
      🔥 Seu acesso foi liberado!
    </h1>
    <p style="margin:0 0 32px;color:#a0a0a0;font-size:15px;text-align:center;line-height:1.5;">
      Fala, <strong style="color:#ffffff;">${name}</strong>! Sua jornada de transformação começa agora.
    </p>

    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 32px;">
    <tr><td align="center">
      <a href="${accessUrl}" target="_blank" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#FF6B00,#FBB707);color:#000000;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.5px;">
        ACESSAR A PLATAFORMA
      </a>
    </td></tr>
    </table>

    <!-- Credentials box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0d;border:1px solid #333;border-radius:12px;margin:0 0 24px;">
    <tr><td style="padding:24px;">
      <p style="margin:0 0 16px;color:#FBB707;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;text-align:center;">
        Seus dados de acesso
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:14px;width:80px;">E-mail:</td>
          <td style="padding:8px 0;color:#ffffff;font-size:14px;font-weight:600;">${email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:14px;border-top:1px solid #222;width:80px;">Senha:</td>
          <td style="padding:8px 0;color:#ffffff;font-size:14px;font-weight:600;border-top:1px solid #222;">${password}</td>
        </tr>
      </table>
    </td></tr>
    </table>

    <p style="margin:0 0 8px;color:#666;font-size:12px;text-align:center;line-height:1.5;">
      Recomendamos alterar sua senha após o primeiro acesso.
    </p>

  </td></tr>

  <!-- Steps -->
  <tr><td style="padding:32px 0 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;text-align:center;width:33%;">
          <div style="font-size:24px;margin-bottom:8px;">1️⃣</div>
          <p style="margin:0;color:#FF6B00;font-size:12px;font-weight:600;">Faça Login</p>
          <p style="margin:4px 0 0;color:#666;font-size:11px;">Use suas credenciais</p>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;text-align:center;width:33%;">
          <div style="font-size:24px;margin-bottom:8px;">2️⃣</div>
          <p style="margin:0;color:#FF6B00;font-size:12px;font-weight:600;">Preencha a Anamnese</p>
          <p style="margin:4px 0 0;color:#666;font-size:11px;">Nos conte sobre você</p>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;text-align:center;width:33%;">
          <div style="font-size:24px;margin-bottom:8px;">3️⃣</div>
          <p style="margin:0;color:#FF6B00;font-size:12px;font-weight:600;">Receba seu Plano</p>
          <p style="margin:4px 0 0;color:#666;font-size:11px;">Personalizado pra você</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:32px 0 0;">
    <div style="height:1px;background:linear-gradient(90deg,transparent,#333,transparent);"></div>
  </td></tr>
  <tr><td style="padding:24px 0 0;text-align:center;">
    <p style="margin:0 0 4px;color:#444;font-size:11px;">Esta é uma mensagem automática. Por favor, não responda este e-mail.</p>
    <p style="margin:0 0 16px;color:#444;font-size:11px;">Em caso de dúvidas, utilize o chat de suporte dentro da plataforma.</p>
    <p style="margin:0;color:#555;font-size:11px;">© 2026 <strong style="color:#FF6B00;">Shape Insano</strong>. Todos os direitos reservados.</p>
    <p style="margin:8px 0 0;color:#333;font-size:10px;">SER INSANO É SER UM VENCEDOR</p>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

async function autoProvisionAccount(
  supabase: any,
  customerEmail: string,
  customerName: string | null,
  cpf: string | null,
  planValue: number | null,
  inviteId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const email = customerEmail.toLowerCase();
  const password = generateSecurePassword(cpf, email);
  const nome = customerName || email.split("@")[0];

  console.log("[asaas-webhook] Auto-provisioning account for:", email);

  // Update invite status to "processing"
  if (inviteId) {
    await supabase
      .from("invites")
      .update({ status: "pending", payment_status: "paid" })
      .eq("id", inviteId);
  }

  // 1. Create auth user
  let userId: string | null = null;
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (createError) {
    if (createError.message.includes("already been registered")) {
      console.log("[asaas-webhook] User already exists:", email);
      // Find existing user and update password
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
      if (existingUser) {
        userId = existingUser.id;
        await supabase.auth.admin.updateUserById(existingUser.id, { password });
        console.log("[asaas-webhook] Password updated for existing user:", existingUser.id);
      }
    } else {
      console.error("[asaas-webhook] User creation failed:", createError.message);
      return { success: false, error: createError.message };
    }
  } else {
    userId = newUser.user.id;
    console.log("[asaas-webhook] User created:", userId);
  }

  // 2. Update profile if needed
  if (userId) {
    const profileUpdate: Record<string, any> = { nome, email };
    if (cpf) profileUpdate.cpf = (cpf || "").replace(/\D/g, "");
    
    await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);
  }

  // 3. Create subscription if plan value exists
  if (userId && planValue && planValue > 0) {
    const { error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_price: planValue,
        status: "active",
      });
    if (subError) {
      console.error("[asaas-webhook] Subscription insert error:", subError);
    }
  }

  // 4. Mark invite as used
  if (inviteId) {
    await supabase
      .from("invites")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", inviteId);
    console.log("[asaas-webhook] Invite marked as used:", inviteId);
  }

  // 5. Send credentials email via Gmail SMTP
  try {
    const accessUrl = "https://shapeinsano.lovable.app";
    const logoUrl = "https://shapeinsano.lovable.app/insano-logo.png";
    const htmlContent = buildCredentialEmailHtml(nome, email, password, accessUrl, logoUrl);
    const result = await sendEmail({
      to: email,
      toName: nome,
      subject: "🔥 Seu acesso ao Shape Insano foi liberado!",
      htmlContent,
    });

    if (!result.ok) {
      console.error("[asaas-webhook] Email send failed:", result.error);
      return { success: true, error: "Email send failed" };
    }
    console.log("[asaas-webhook] Credentials email sent to:", email);
  } catch (emailErr) {
    console.error("[asaas-webhook] Email send error:", emailErr);
    return { success: true, error: "Email send exception" };
  }

  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Webhook Token Validation (optional - warns if not set) ---
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (webhookToken) {
      const tokenHeader = req.headers.get("asaas-access-token");
      if (tokenHeader !== webhookToken) {
        console.error("[asaas-webhook] Invalid webhook token");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.error("[asaas-webhook] ASAAS_WEBHOOK_TOKEN not configured — rejecting request");
      return new Response(JSON.stringify({ error: "Webhook token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("[asaas-webhook] Received event:", body.event);

    const event = body.event;
    if (event !== "PAYMENT_CONFIRMED" && event !== "PAYMENT_RECEIVED") {
      console.log("[asaas-webhook] Ignoring event:", event);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = body.payment;
    if (!payment) {
      return new Response(JSON.stringify({ error: "No payment data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // payment.customer is a string ID (e.g. "cus_xxxx"), NOT an object
    const customerId = typeof payment.customer === "string"
      ? payment.customer
      : payment.customer?.id || payment.customer;

    const planValue = payment.value;

    if (!customerId) {
      console.error("[asaas-webhook] No customer ID found in payment payload");
      return new Response(JSON.stringify({ error: "Missing customer ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch full customer details from Asaas API
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      console.error("[asaas-webhook] ASAAS_API_KEY not configured");
      return new Response(JSON.stringify({ error: "ASAAS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[asaas-webhook] Fetching customer details for:", customerId);
    let customerData: any;
    try {
      customerData = await asaasRequest("GET", `/customers/${customerId}`, ASAAS_API_KEY);
    } catch (fetchErr: any) {
      console.error("[asaas-webhook] Failed to fetch customer from Asaas:", fetchErr.message);
      return new Response(JSON.stringify({ error: "Failed to fetch customer details" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerEmail = customerData.email;
    const customerName = customerData.name || null;
    const customerCpf = customerData.cpfCnpj || null;

    console.log("[asaas-webhook] Customer resolved:", { email: customerEmail, name: customerName, cpf: customerCpf ? "***" : null });

    if (!customerEmail) {
      console.error("[asaas-webhook] Customer has no email in Asaas:", customerId);
      return new Response(JSON.stringify({ error: "Customer has no email in Asaas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Idempotency Check ---
    const idempotencyKey = `webhook_${payment.id}_${event}`;
    const { data: existingKey } = await supabase
      .from("idempotency_keys")
      .select("key, response")
      .eq("key", idempotencyKey)
      .maybeSingle();

    if (existingKey) {
      console.log("[asaas-webhook] Duplicate webhook, returning cached:", idempotencyKey);
      return new Response(JSON.stringify(existingKey.response || { ok: true, deduplicated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Find existing pending invite ---
    const { data: existingInvite } = await supabase
      .from("invites")
      .select("id, cpf, name, payment_status, status, plan_value")
      .eq("email", customerEmail.toLowerCase())
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let inviteId: string | null = null;
    let inviteCpf: string | null = customerCpf;
    let inviteName: string | null = customerName;
    let effectivePlanValue = planValue;

    if (existingInvite) {
      // Update payment_status to paid
      await supabase
        .from("invites")
        .update({ payment_status: "paid" })
        .eq("id", existingInvite.id);

      inviteId = existingInvite.id;
      inviteCpf = existingInvite.cpf || customerCpf;
      inviteName = existingInvite.name || customerName;
      effectivePlanValue = existingInvite.plan_value || planValue;
      console.log("[asaas-webhook] Updated invite to paid:", existingInvite.id);
    } else {
      // Check if already processed
      const { data: alreadyUsedInvite } = await supabase
        .from("invites")
        .select("id")
        .eq("email", customerEmail.toLowerCase())
        .eq("status", "used")
        .maybeSingle();

      if (alreadyUsedInvite) {
        console.log("[asaas-webhook] Invite already used for:", customerEmail);
        const response = { ok: true, message: "Already processed" };
        await supabase.from("idempotency_keys").insert({ key: idempotencyKey, response });
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-create invite with paid status
      const { data: newInvite, error: inviteError } = await supabase
        .from("invites")
        .insert({
          email: customerEmail.toLowerCase(),
          name: customerName || null,
          cpf: customerCpf || null,
          plan_value: planValue || null,
          status: "pending",
          payment_status: "paid",
        })
        .select("id, cpf, name")
        .single();

      if (inviteError) {
        console.error("[asaas-webhook] Error creating invite:", inviteError);
        return new Response(JSON.stringify({ error: "Failed to create invite" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      inviteId = newInvite.id;
      inviteCpf = newInvite.cpf || customerCpf;
      inviteName = newInvite.name || customerName;
      console.log("[asaas-webhook] Auto-created paid invite:", newInvite.id);
    }

    // --- AUTO-PROVISION: Create account + send credentials ---
    const result = await autoProvisionAccount(supabase, customerEmail, inviteName, inviteCpf, effectivePlanValue, inviteId);

    const response = { ok: true, invite_id: inviteId, action: "auto_provisioned", ...result };
    await supabase.from("idempotency_keys").insert({ key: idempotencyKey, response });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[asaas-webhook] Error:", err?.message || err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
