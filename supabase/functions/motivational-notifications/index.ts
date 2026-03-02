import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Motivational Notifications (Estilo Duolingo)
 * 
 * Called via cron at:
 * - 22:00 UTC (19:00 BRT) → Alerta de Chama em Risco
 * - 01:00 UTC (22:00 BRT) → Última Chance / Ultimato
 * 
 * Sends push notifications to users whose flame hasn't been approved today.
 */

const RESCUE_19H_MESSAGES = [
  "Seria um desperdício total você jogar {streak} dias de esforço no lixo hoje, não acha? Salva essa chama. 🔥",
  "A sua Chama está por um fio. Vai deixar o cansaço ser maior que sua disciplina hoje?",
  "Seria um saco você perder sua ofensiva de {streak} dias agora, hein? Bora agir! 💪",
  "{streak} dias seguidos. Vai quebrar a corrente logo hoje? Eu duvido.",
  "O sofá tá gostoso, né? Mas ele não vai te dar shape. Sua Chama tá pedindo socorro. 🔥",
  "Fala sério… {streak} dias de disciplina e você vai estragar tudo com uma noite de preguiça?",
  "Sua versão de amanhã vai te agradecer. Ou te xingar. Depende do que você fizer agora. 🏋️",
];

const RESCUE_22H_MESSAGES = [
  "Faltam 2 horas. Ou você treina agora ou bate a meta da dieta. A sua Chama de Honra não sobrevive à meia-noite sem ação. ⏰🔥",
  "Último aviso. Meia-noite tá chegando e a sua Chama vai apagar. Qual vai ser?",
  "A Chama não sobrevive à meia-noite sem treino ou dieta. {streak} dias na reta. É agora ou nunca.",
  "Tick-tock. Suas {streak} dias de ofensiva dependem das próximas 2 horas. Vai ficar parado?",
  "⚠️ Alerta final: 2h pra meia-noite. Um treino rápido ou 50% da dieta salva tudo. Bora!",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(msg: string, streak: number): string {
  return msg.replace(/{streak}/g, String(streak));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determine which alert type based on current BRT time
    const now = new Date();
    const brtHour = (now.getUTCHours() - 3 + 24) % 24;
    
    // Allow manual override via query param
    const url = new URL(req.url);
    const forceType = url.searchParams.get("type"); // "19h" or "22h"
    
    let alertType: "19h" | "22h";
    if (forceType === "19h" || forceType === "22h") {
      alertType = forceType;
    } else if (brtHour >= 21 || brtHour < 3) {
      alertType = "22h";
    } else {
      alertType = "19h";
    }

    console.log(`[motivational] Alert type: ${alertType}, BRT hour: ${brtHour}`);

    // Get today's date in BRT
    const brtOffset = -3 * 60 * 60 * 1000;
    const brtNow = new Date(now.getTime() + brtOffset);
    const todayStr = brtNow.toISOString().split("T")[0];

    // Get all users with active or trégua flames that haven't approved today
    const { data: flames, error: flameErr } = await supabase
      .from("flame_status")
      .select("user_id, state, streak, last_approved_date")
      .in("state", ["ativa", "tregua"]);

    if (flameErr) {
      console.error("Error fetching flames:", flameErr);
      return new Response(JSON.stringify({ error: flameErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter: only users who haven't approved today
    const atRisk = (flames || []).filter(f => f.last_approved_date !== todayStr);
    console.log(`[motivational] Users at risk: ${atRisk.length}`);

    let notifCount = 0;

    for (const flame of atRisk) {
      const messages = alertType === "19h" ? RESCUE_19H_MESSAGES : RESCUE_22H_MESSAGES;
      const rawMsg = pickRandom(messages);
      const body = fillTemplate(rawMsg, flame.streak || 1);
      const title = alertType === "19h" ? "🔥 Sua Chama precisa de você!" : "⚠️ Última Chance!";

      // Insert notification (triggers push via DB trigger)
      const { error: insertErr } = await supabase
        .from("notifications")
        .insert({
          user_id: flame.user_id,
          title,
          body,
          type: "flame_rescue",
          metadata: { alert_type: alertType, streak: flame.streak },
        });

      if (insertErr) {
        console.error(`[motivational] Failed for ${flame.user_id}:`, insertErr.message);
      } else {
        notifCount++;
      }
    }

    console.log(`[motivational] Sent ${notifCount} notifications`);
    return new Response(JSON.stringify({ sent: notifCount, type: alertType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
