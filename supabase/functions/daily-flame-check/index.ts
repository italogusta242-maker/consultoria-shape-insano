import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Motor 2: O Juiz da Meia-Noite
 *
 * Runs at 03:00 UTC (00:00 BRT) via cron.
 * Checks all users with flame_status and demotes those who didn't
 * do anything yesterday (no training, no 50% diet).
 *
 * - Ativa → Trégua (if yesterday not approved)
 * - Trégua → Extinta (if yesterday not approved, streak = 0)
 * - Normal stays Normal
 * - Extinta stays Extinta
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Yesterday in BRT (UTC-3)
    const now = new Date();
    const brtOffset = -3 * 60 * 60 * 1000;
    const brtNow = new Date(now.getTime() + brtOffset);
    const yesterday = new Date(brtNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    console.log(`[daily-flame-check] Running for date: ${yesterdayStr}`);

    // Get all users with flame_status that are ativa or tregua
    const { data: activeFlames, error: fetchErr } = await supabase
      .from("flame_status")
      .select("user_id, state, streak, last_approved_date")
      .in("state", ["ativa", "tregua"]);

    if (fetchErr) {
      console.error("Error fetching flame statuses:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!activeFlames || activeFlames.length === 0) {
      console.log("[daily-flame-check] No active/truce flames to process");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let demotedToTruce = 0;
    let demotedToExtinct = 0;
    let unchanged = 0;

    for (const flame of activeFlames) {
      // If last_approved_date is yesterday or today (BRT), user is fine
      if (flame.last_approved_date === yesterdayStr) {
        unchanged++;
        continue;
      }

      // Also check today's date in case of late-night activity
      const todayStr = brtNow.toISOString().split("T")[0];
      if (flame.last_approved_date === todayStr) {
        unchanged++;
        continue;
      }

      // Check if user did anything yesterday
      const approved = await isDayApproved(supabase, flame.user_id, yesterdayStr);

      if (approved) {
        // Update last_approved_date
        await supabase
          .from("flame_status")
          .update({ last_approved_date: yesterdayStr, updated_at: new Date().toISOString() })
          .eq("user_id", flame.user_id);
        unchanged++;
      } else {
        // Demote
        if (flame.state === "ativa") {
          await supabase
            .from("flame_status")
            .update({ state: "tregua", updated_at: new Date().toISOString() })
            .eq("user_id", flame.user_id);
          demotedToTruce++;
        } else if (flame.state === "tregua") {
          await supabase
            .from("flame_status")
            .update({ state: "extinta", streak: 0, updated_at: new Date().toISOString() })
            .eq("user_id", flame.user_id);
          demotedToExtinct++;
        }
      }
    }

    const result = {
      processed: activeFlames.length,
      unchanged,
      demotedToTruce,
      demotedToExtinct,
      date: yesterdayStr,
    };

    console.log("[daily-flame-check] Results:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[daily-flame-check] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Check if a day is "approved" for the flame system (server-side version).
 * Approved if user did at least one of: training OR ≥50% diet meals.
 */
async function isDayApproved(
  supabase: any,
  userId: string,
  dateStr: string
): Promise<boolean> {
  // Check workouts
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("finished_at", `${dateStr}T00:00:00`)
    .lt("finished_at", `${dateStr}T23:59:59.999`)
    .limit(1);

  if (workouts && workouts.length > 0) return true;

  // Check diet (50% of meals) — guard against 0/0 false positive
  const { data: dietPlan } = await supabase
    .from("diet_plans")
    .select("meals")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // No active diet plan or empty meals → cannot approve by diet
  const totalMeals = Array.isArray(dietPlan?.meals) ? dietPlan.meals.length : 0;
  if (totalMeals === 0) return false;

  const { data: habits } = await supabase
    .from("daily_habits")
    .select("completed_meals")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .maybeSingle();

  if (habits?.completed_meals && Array.isArray(habits.completed_meals)) {
    const percentage = habits.completed_meals.length / totalMeals;
    if (percentage >= 0.5) return true;
  }

  return false;
}
