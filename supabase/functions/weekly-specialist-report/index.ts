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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoISO = weekAgo.toISOString();

    // Get all specialists (with roles especialista, nutricionista, personal)
    const { data: specialistRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["especialista", "nutricionista", "personal"]);

    if (!specialistRoles?.length) {
      return new Response(JSON.stringify({ message: "No specialists found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate specialist IDs
    const specialistIds = [...new Set(specialistRoles.map((r) => r.user_id))];

    let totalNotifications = 0;

    for (const specialistId of specialistIds) {
      // Get assigned students
      const { data: links } = await supabase
        .from("student_specialists")
        .select("student_id")
        .eq("specialist_id", specialistId);

      if (!links?.length) continue;

      const studentIds = [...new Set(links.map((l) => l.student_id))];

      // Get student profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", studentIds);

      const nameMap = new Map(
        (profiles || []).map((p) => [p.id, p.nome || "Aluno"])
      );

      // Get workouts for the week
      const { data: workouts } = await supabase
        .from("workouts")
        .select("user_id, duration_seconds, effort_rating, comment, finished_at")
        .in("user_id", studentIds)
        .gte("started_at", weekAgoISO)
        .not("finished_at", "is", null);

      // Get daily habits for the week
      const { data: habits } = await supabase
        .from("daily_habits")
        .select("user_id, date, water_liters, completed_meals")
        .in("user_id", studentIds)
        .gte("date", weekAgo.toISOString().slice(0, 10));

      // Get psych checkins for the week
      const { data: checkins } = await supabase
        .from("psych_checkins")
        .select("user_id, mood, stress, sleep_hours, notes")
        .in("user_id", studentIds)
        .gte("created_at", weekAgoISO);

      // Build per-student summary
      const alerts: string[] = [];
      const summaryLines: string[] = [];

      for (const sid of studentIds) {
        const name = nameMap.get(sid) || "Aluno";
        const studentWorkouts = (workouts || []).filter((w) => w.user_id === sid);
        const studentHabits = (habits || []).filter((h) => h.user_id === sid);
        const studentCheckins = (checkins || []).filter((c) => c.user_id === sid);

        const treinos = studentWorkouts.length;
        const avgEffort =
          treinos > 0
            ? (
                studentWorkouts.reduce(
                  (sum, w) => sum + (w.effort_rating || 0),
                  0
                ) / treinos
              ).toFixed(1)
            : "—";

        // Avg water
        const avgWater =
          studentHabits.length > 0
            ? (
                studentHabits.reduce((sum, h) => sum + Number(h.water_liters || 0), 0) /
                studentHabits.length
              ).toFixed(1)
            : "—";

        // Avg mood & stress
        const avgMood =
          studentCheckins.length > 0
            ? (
                studentCheckins.reduce((sum, c) => sum + c.mood, 0) /
                studentCheckins.length
              ).toFixed(1)
            : "—";
        const avgStress =
          studentCheckins.length > 0
            ? (
                studentCheckins.reduce((sum, c) => sum + c.stress, 0) /
                studentCheckins.length
              ).toFixed(1)
            : "—";

        // Diet adherence (avg meals completed)
        const avgMeals =
          studentHabits.length > 0
            ? (
                studentHabits.reduce(
                  (sum, h) => sum + (h.completed_meals?.length || 0),
                  0
                ) / studentHabits.length
              ).toFixed(1)
            : "—";

        summaryLines.push(
          `• ${name}: ${treinos} treinos | Esforço ${avgEffort}/10 | Água ${avgWater}L | Refeições ${avgMeals}/dia | Humor ${avgMood} | Estresse ${avgStress}`
        );

        // Alerts
        if (treinos === 0) {
          alerts.push(`⚠️ ${name} não treinou esta semana`);
        }
        if (studentCheckins.length > 0 && Number(avgStress) >= 4) {
          alerts.push(`🔴 ${name} com estresse elevado (${avgStress})`);
        }
        if (studentCheckins.length > 0 && Number(avgMood) <= 2) {
          alerts.push(`🔴 ${name} com humor baixo (${avgMood})`);
        }
        if (studentHabits.length > 0 && Number(avgWater) < 1.5) {
          alerts.push(`⚠️ ${name} com hidratação baixa (${avgWater}L)`);
        }

        // Comments/complaints
        const complaints = studentWorkouts
          .filter((w) => w.comment && w.comment.trim().length > 0)
          .map((w) => w.comment!.trim());
        if (complaints.length > 0) {
          alerts.push(`💬 ${name} deixou ${complaints.length} observação(ões) nos treinos`);
        }
      }

      // Build notification body
      const alertSection =
        alerts.length > 0
          ? `\n\n🚨 Alertas:\n${alerts.join("\n")}`
          : "\n\n✅ Sem alertas esta semana";

      const body = `📊 Resumo da Semana (${studentIds.length} alunos):\n\n${summaryLines.join(
        "\n"
      )}${alertSection}`;

      // Insert notification
      await supabase.from("notifications").insert({
        user_id: specialistId,
        title: "📋 Relatório Semanal dos Alunos",
        body: body.slice(0, 2000),
        type: "weekly_report",
        metadata: {
          student_count: studentIds.length,
          alert_count: alerts.length,
          week_start: weekAgo.toISOString().slice(0, 10),
          week_end: now.toISOString().slice(0, 10),
        },
      });

      totalNotifications++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: totalNotifications,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Weekly report error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
