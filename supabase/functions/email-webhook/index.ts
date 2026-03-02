import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("[email-webhook] Received:", JSON.stringify(body).substring(0, 500));

    // Brevo sends webhooks as single events or arrays
    const events = Array.isArray(body) ? body : [body];

    for (const event of events) {
      const eventType = event.event || event.type || "";
      const tags = event.tags || event.tag || [];
      const tagList = Array.isArray(tags) ? tags : [tags];

      // Find invite_id from tags (format: "invite:UUID")
      const inviteTag = tagList.find((t: string) => typeof t === "string" && t.startsWith("invite:"));
      if (!inviteTag) {
        console.log("[email-webhook] No invite tag found, skipping event:", eventType);
        continue;
      }

      const inviteId = inviteTag.replace("invite:", "");
      console.log("[email-webhook] Event:", eventType, "Invite:", inviteId);

      if (eventType === "opened" || eventType === "unique_opened" || eventType === "open") {
        const { error } = await supabaseAdmin
          .from("invites")
          .update({ email_opened_at: new Date().toISOString() })
          .eq("id", inviteId)
          .is("email_opened_at", null);

        if (error) {
          console.error("[email-webhook] Update opened error:", error.message);
        } else {
          console.log("[email-webhook] Marked as opened:", inviteId);
        }
      }

      if (eventType === "click" || eventType === "clicked") {
        const { error } = await supabaseAdmin
          .from("invites")
          .update({ payment_link_clicked_at: new Date().toISOString() })
          .eq("id", inviteId)
          .is("payment_link_clicked_at", null);

        if (error) {
          console.error("[email-webhook] Update clicked error:", error.message);
        } else {
          console.log("[email-webhook] Marked as clicked:", inviteId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("[email-webhook] Error:", (err as Error)?.message || err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
