import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STALE_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const staleDate = new Date(
      Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // Find all active training plans not updated in 30+ days
    const { data: stalePlans, error: tpErr } = await supabase
      .from("training_plans")
      .select("id, user_id, specialist_id, title, updated_at")
      .eq("active", true)
      .lt("updated_at", staleDate);

    if (tpErr) throw tpErr;

    // Find all active diet plans not updated in 30+ days
    const { data: staleDiets, error: dpErr } = await supabase
      .from("diet_plans")
      .select("id, user_id, specialist_id, title, updated_at")
      .eq("active", true)
      .lt("updated_at", staleDate);

    if (dpErr) throw dpErr;

    // Get student names
    const allStudentIds = [
      ...new Set([
        ...(stalePlans ?? []).map((p) => p.user_id),
        ...(staleDiets ?? []).map((p) => p.user_id),
      ]),
    ];

    let nameMap = new Map<string, string>();
    if (allStudentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", allStudentIds);
      nameMap = new Map(
        (profiles ?? []).map((p) => [p.id, p.nome ?? p.email ?? "Aluno"])
      );
    }

    // Collect unique specialist IDs for email sending
    const specialistIds = new Set<string>();

    const notifications: {
      user_id: string;
      type: string;
      title: string;
      body: string;
      metadata: Record<string, unknown>;
    }[] = [];

    // Training plan notifications → send to specialist
    for (const plan of stalePlans ?? []) {
      if (!plan.specialist_id) continue;
      specialistIds.add(plan.specialist_id);
      const studentName = nameMap.get(plan.user_id) ?? "Aluno";
      const daysSince = Math.floor(
        (Date.now() - new Date(plan.updated_at).getTime()) / 86400000
      );

      // Check if we already sent a notification for this plan in the last 7 days
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", plan.specialist_id)
        .eq("type", "stale_plan")
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 86400000).toISOString()
        )
        .contains("metadata", { plan_id: plan.id })
        .limit(1);

      if ((existing ?? []).length > 0) continue;

      notifications.push({
        user_id: plan.specialist_id,
        type: "stale_plan",
        title: `Treino de ${studentName} precisa de revisão`,
        body: `O plano "${plan.title}" não é atualizado há ${daysSince} dias.`,
        metadata: {
          plan_id: plan.id,
          plan_type: "training",
          student_id: plan.user_id,
          student_name: studentName,
          days_since: daysSince,
        },
      });
    }

    // Diet plan notifications → send to specialist
    for (const plan of staleDiets ?? []) {
      if (!plan.specialist_id) continue;
      specialistIds.add(plan.specialist_id);
      const studentName = nameMap.get(plan.user_id) ?? "Aluno";
      const daysSince = Math.floor(
        (Date.now() - new Date(plan.updated_at).getTime()) / 86400000
      );

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", plan.specialist_id)
        .eq("type", "stale_plan")
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 86400000).toISOString()
        )
        .contains("metadata", { plan_id: plan.id })
        .limit(1);

      if ((existing ?? []).length > 0) continue;

      notifications.push({
        user_id: plan.specialist_id,
        type: "stale_plan",
        title: `Dieta de ${studentName} precisa de revisão`,
        body: `O plano "${plan.title}" não é atualizado há ${daysSince} dias.`,
        metadata: {
          plan_id: plan.id,
          plan_type: "diet",
          student_id: plan.user_id,
          student_name: studentName,
          days_since: daysSince,
        },
      });
    }

    // === CRITICAL PROACTIVE ALERTS ===
    // Check anamnese pending review 3+ days, expired plans 7+ days, inactive students 14+ days
    const today = new Date();

    // 1. Anamnese pending review ≥3 days → notify assigned specialists
    const { data: pendingAnamneses } = await supabase
      .from("anamnese")
      .select("id, user_id, created_at")
      .eq("reviewed", false);

    for (const anam of pendingAnamneses ?? []) {
      const daysSince = Math.floor((Date.now() - new Date(anam.created_at).getTime()) / 86400000);
      if (daysSince < 3) continue;

      const studentName = nameMap.get(anam.user_id) ?? "Aluno";
      // Find specialists assigned to this student
      const { data: links } = await supabase
        .from("student_specialists")
        .select("specialist_id")
        .eq("student_id", anam.user_id);

      for (const link of links ?? []) {
        // Deduplicate: check if already notified in last 3 days
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", link.specialist_id)
          .eq("type", "critical_alert")
          .gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString())
          .contains("metadata", { alert_type: "anamnese_review", student_id: anam.user_id })
          .limit(1);

        if ((existing ?? []).length > 0) continue;

        notifications.push({
          user_id: link.specialist_id,
          type: "critical_alert",
          title: `🚨 Anamnese de ${studentName} sem revisão`,
          body: `A anamnese está há ${daysSince} dias aguardando revisão.`,
          metadata: {
            alert_type: "anamnese_review",
            student_id: anam.user_id,
            student_name: studentName,
            days_since: daysSince,
          },
        });
      }
    }

    // 2. Plans expired 7+ days → notify specialist
    const { data: expiredTraining } = await supabase
      .from("training_plans")
      .select("id, user_id, specialist_id, title, valid_until")
      .eq("active", true)
      .not("valid_until", "is", null)
      .lt("valid_until", today.toISOString().split("T")[0]);

    const { data: expiredDiets } = await supabase
      .from("diet_plans")
      .select("id, user_id, specialist_id, title, valid_until")
      .eq("active", true)
      .not("valid_until", "is", null)
      .lt("valid_until", today.toISOString().split("T")[0]);

    for (const plan of [...(expiredTraining ?? []), ...(expiredDiets ?? [])]) {
      if (!plan.specialist_id || !plan.valid_until) continue;
      const daysExpired = Math.floor((Date.now() - new Date(plan.valid_until).getTime()) / 86400000);
      if (daysExpired < 7) continue;

      // Ensure name is in map
      if (!nameMap.has(plan.user_id)) {
        const { data: p } = await supabase.from("profiles").select("id, nome, email").eq("id", plan.user_id).single();
        if (p) nameMap.set(p.id, p.nome ?? p.email ?? "Aluno");
      }
      const studentName = nameMap.get(plan.user_id) ?? "Aluno";

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", plan.specialist_id)
        .eq("type", "critical_alert")
        .gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString())
        .contains("metadata", { alert_type: "plan_expired", plan_id: plan.id })
        .limit(1);

      if ((existing ?? []).length > 0) continue;

      notifications.push({
        user_id: plan.specialist_id,
        type: "critical_alert",
        title: `🚨 Plano de ${studentName} expirado`,
        body: `O plano "${plan.title}" expirou há ${daysExpired} dias e precisa de atenção.`,
        metadata: {
          alert_type: "plan_expired",
          plan_id: plan.id,
          student_id: plan.user_id,
          student_name: studentName,
          days_expired: daysExpired,
        },
      });
    }

    // 3. Inactive students (no workouts 14+ days) → notify personal trainer
    const cutoff14 = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: personalLinks } = await supabase
      .from("student_specialists")
      .select("student_id, specialist_id")
      .eq("specialty", "personal");

    for (const link of personalLinks ?? []) {
      const { data: recentWorkouts } = await supabase
        .from("workouts")
        .select("id")
        .eq("user_id", link.student_id)
        .gte("started_at", cutoff14)
        .not("finished_at", "is", null)
        .limit(1);

      if ((recentWorkouts ?? []).length > 0) continue;

      // Check if student has an active plan
      const { data: activePlan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", link.student_id)
        .eq("active", true)
        .limit(1);

      if ((activePlan ?? []).length === 0) continue;

      if (!nameMap.has(link.student_id)) {
        const { data: p } = await supabase.from("profiles").select("id, nome, email").eq("id", link.student_id).single();
        if (p) nameMap.set(p.id, p.nome ?? p.email ?? "Aluno");
      }
      const studentName = nameMap.get(link.student_id) ?? "Aluno";

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", link.specialist_id)
        .eq("type", "critical_alert")
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .contains("metadata", { alert_type: "inactive_student", student_id: link.student_id })
        .limit(1);

      if ((existing ?? []).length > 0) continue;

      notifications.push({
        user_id: link.specialist_id,
        type: "critical_alert",
        title: `🚨 ${studentName} inativo há +14 dias`,
        body: `O aluno não registra treinos há mais de 14 dias.`,
        metadata: {
          alert_type: "inactive_student",
          student_id: link.student_id,
          student_name: studentName,
        },
      });
    }

    // 4. Assessment overdue 30+ days → notify all assigned specialists
    const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: allLinks } = await supabase
      .from("student_specialists")
      .select("student_id, specialist_id");

    const studentIdsFromLinks = [...new Set((allLinks ?? []).map((l) => l.student_id))];

    // Get latest assessment per student
    const { data: allAssessments } = await supabase
      .from("monthly_assessments")
      .select("user_id, created_at")
      .in("user_id", studentIdsFromLinks)
      .order("created_at", { ascending: false });

    const latestAssessment = new Map<string, string>();
    for (const a of allAssessments ?? []) {
      if (!latestAssessment.has(a.user_id)) latestAssessment.set(a.user_id, a.created_at);
    }

    // Check onboarded students only
    const { data: onboardedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .in("id", studentIdsFromLinks)
      .eq("onboarded", true);
    const onboardedSet = new Set((onboardedProfiles ?? []).map((p) => p.id));

    for (const link of allLinks ?? []) {
      if (!onboardedSet.has(link.student_id)) continue;

      const lastDate = latestAssessment.get(link.student_id);
      if (!lastDate) continue; // never done - separate concern
      const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
      if (daysSince < 30) continue;

      if (!nameMap.has(link.student_id)) {
        const { data: p } = await supabase.from("profiles").select("id, nome, email").eq("id", link.student_id).single();
        if (p) nameMap.set(p.id, p.nome ?? p.email ?? "Aluno");
      }
      const studentName = nameMap.get(link.student_id) ?? "Aluno";

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", link.specialist_id)
        .eq("type", "critical_alert")
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .contains("metadata", { alert_type: "assessment_overdue", student_id: link.student_id })
        .limit(1);

      if ((existing ?? []).length > 0) continue;

      notifications.push({
        user_id: link.specialist_id,
        type: "critical_alert",
        title: `🚨 Reavaliação de ${studentName} atrasada`,
        body: `O aluno não preenche a reavaliação mensal há ${daysSince} dias.`,
        metadata: {
          alert_type: "assessment_overdue",
          student_id: link.student_id,
          student_name: studentName,
          days_since: daysSince,
        },
      });
    }

    // 5. Churn risk — subscription expiring within 3 days or overdue
    const { data: activeSubs } = await supabase
      .from("subscriptions")
      .select("user_id, started_at, plan_price, status")
      .eq("status", "active");

    const { data: subPlansList } = await supabase
      .from("subscription_plans")
      .select("price, duration_months")
      .eq("active", true);

    const priceToDuration = new Map<number, number>();
    for (const sp of subPlansList ?? []) {
      priceToDuration.set(Number(sp.price), sp.duration_months);
    }

    for (const sub of activeSubs ?? []) {
      const duration = priceToDuration.get(sub.plan_price) ?? 1;
      const expiry = new Date(sub.started_at);
      expiry.setMonth(expiry.getMonth() + duration);
      const daysUntil = Math.floor((expiry.getTime() - Date.now()) / 86400000);

      // Only alert if expiring in 3 days or less, or overdue
      if (daysUntil > 3) continue;

      // Get specialists for this student
      const { data: links } = await supabase
        .from("student_specialists")
        .select("specialist_id")
        .eq("student_id", sub.user_id);

      if (!links || links.length === 0) continue;

      if (!nameMap.has(sub.user_id)) {
        const { data: p } = await supabase.from("profiles").select("id, nome, email").eq("id", sub.user_id).single();
        if (p) nameMap.set(p.id, p.nome ?? p.email ?? "Aluno");
      }
      const studentName = nameMap.get(sub.user_id) ?? "Aluno";

      const alertTitle = daysUntil < 0
        ? `🚨 Assinatura de ${studentName} vencida`
        : `⚠️ Assinatura de ${studentName} vence em ${daysUntil} dia${daysUntil !== 1 ? "s" : ""}`;
      const alertBody = daysUntil < 0
        ? `A assinatura venceu há ${Math.abs(daysUntil)} dias sem renovação. Risco de churn!`
        : `A assinatura vence em ${daysUntil} dia${daysUntil !== 1 ? "s" : ""}. Entre em contato para renovação.`;

      for (const link of links) {
        // Deduplicate: check if already notified in last 3 days
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", link.specialist_id)
          .eq("type", "critical_alert")
          .gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString())
          .contains("metadata", { alert_type: "churn_risk", student_id: sub.user_id })
          .limit(1);

        if ((existing ?? []).length > 0) continue;

        notifications.push({
          user_id: link.specialist_id,
          type: "critical_alert",
          title: alertTitle,
          body: alertBody,
          metadata: {
            alert_type: "churn_risk",
            student_id: sub.user_id,
            student_name: studentName,
            days_until_expiry: daysUntil,
          },
        });
      }
    }

    let inserted = 0;
    if (notifications.length > 0) {
      const { error: insertErr } = await supabase
        .from("notifications")
        .insert(notifications);
      if (insertErr) throw insertErr;
      inserted = notifications.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        stalePlans: (stalePlans ?? []).length,
        staleDiets: (staleDiets ?? []).length,
        notificationsSent: inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-stale-plans error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
