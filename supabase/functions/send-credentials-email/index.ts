import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildEmailHtml(name: string, email: string, password: string, accessUrl: string, logoUrl: string): string {
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

    <!-- Title -->
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

  <!-- Footer divider -->
  <tr><td style="padding:32px 0 0;">
    <div style="height:1px;background:linear-gradient(90deg,transparent,#333,transparent);"></div>
  </td></tr>

  <!-- Footer -->
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { to_email, to_name, access_url, login_email, login_password } = body;

    if (!to_email || !access_url || !login_email || !login_password) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const logoUrl = "https://shapeinsano.lovable.app/insano-logo.png";
    const htmlContent = buildEmailHtml(
      to_name || "Atleta",
      login_email,
      login_password,
      access_url,
      logoUrl
    );

    // Send via Gmail SMTP
    const result = await sendEmail({
      to: to_email,
      toName: to_name || to_email,
      subject: "🔥 Seu acesso ao Shape Insano foi liberado!",
      htmlContent,
    });

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error || "Falha ao enviar e-mail" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[send-credentials-email] Email sent to:", to_email);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-credentials-email] Error:", err?.message || err);
    return new Response(JSON.stringify({ error: "Erro interno: " + (err?.message || "desconhecido") }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
