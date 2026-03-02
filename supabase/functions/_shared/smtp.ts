export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  tags?: string[];
}

export async function sendEmail(options: EmailOptions): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");

  if (!brevoApiKey) {
    console.error("[email] BREVO_API_KEY not configured");
    return { ok: false, error: "Serviço de e-mail não configurado" };
  }

  const gmailUser = Deno.env.get("GMAIL_USER") || "noreply@shapeinsano.com";

  // First, verify the sender is validated in Brevo
  try {
    const sendersRes = await fetch("https://api.brevo.com/v3/senders", {
      headers: {
        "api-key": brevoApiKey,
        "Accept": "application/json",
      },
    });
    const sendersData = await sendersRes.json();
    const senders = sendersData?.senders || [];
    const validSender = senders.find((s: any) => s.email === gmailUser && s.active === true);
    
    if (!validSender) {
      console.error(`[email] Sender "${gmailUser}" is NOT verified in Brevo. Available senders:`, 
        senders.map((s: any) => `${s.email} (active: ${s.active})`).join(", ") || "none");
      
      // Try to use any verified sender as fallback
      const anySender = senders.find((s: any) => s.active === true);
      if (anySender) {
        console.log(`[email] Using fallback verified sender: ${anySender.email}`);
        // Use the verified sender instead
        const payload = {
          sender: { name: "Shape Insano", email: anySender.email },
          to: [{ email: options.to, name: options.toName || options.to }],
          subject: options.subject,
          htmlContent: options.htmlContent,
        };

        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("[email] Brevo error:", res.status, JSON.stringify(data));
          return { ok: false, error: `Brevo API error ${res.status}: ${JSON.stringify(data)}` };
        }

        console.log("[email] Email sent to:", options.to, "via fallback sender:", anySender.email, "messageId:", data.messageId);
        return { ok: true, messageId: data.messageId };
      }
      
      return { ok: false, error: `Remetente "${gmailUser}" não verificado na Brevo e nenhum remetente alternativo disponível` };
    }
  } catch (checkErr: any) {
    console.warn("[email] Could not verify sender, proceeding anyway:", checkErr?.message);
  }

  const payload: Record<string, unknown> = {
    sender: { name: "Shape Insano", email: gmailUser },
    to: [{ email: options.to, name: options.toName || options.to }],
    subject: options.subject,
    htmlContent: options.htmlContent,
  };
  if (options.tags && options.tags.length > 0) {
    payload.tags = options.tags;
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[email] Brevo error:", res.status, JSON.stringify(data));
      return { ok: false, error: `Brevo API error ${res.status}: ${JSON.stringify(data)}` };
    }

    console.log("[email] Email sent to:", options.to, "messageId:", data.messageId);
    return { ok: true, messageId: data.messageId };
  } catch (err: any) {
    console.error("[email] Send error:", err?.message || err);
    return { ok: false, error: err?.message || "Falha ao enviar e-mail" };
  }
}
