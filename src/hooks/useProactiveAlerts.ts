import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInCalendarDays, addMonths } from "date-fns";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "anamnese_review_pending"
  | "anamnese_not_done"
  | "plan_expiring_soon"
  | "plan_expired"
  | "no_plan"
  | "inactive"
  | "onboarding_pending"
  | "assessment_overdue"
  | "churn_risk";

export interface ProactiveAlert {
  id: string;
  type: AlertType;
  studentId: string;
  studentName: string;
  severity: AlertSeverity;
  title: string;
  /** Positive = days overdue/ago, Negative = days remaining */
  daysRelative: number;
  /** Human-friendly label like "há 3 dias" or "em 5 dias" */
  timeLabel: string;
  navigateTo?: string;
}

function buildTimeLabel(days: number, context: "overdue" | "remaining"): string {
  if (context === "overdue") {
    if (days === 0) return "hoje";
    if (days === 1) return "há 1 dia";
    return `há ${days} dias`;
  }
  // remaining
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}

function getSeverity(daysRelative: number, thresholds: { warn: number; critical: number }): AlertSeverity {
  if (daysRelative >= thresholds.critical) return "critical";
  if (daysRelative >= thresholds.warn) return "warning";
  return "info";
}

export function useProactiveAlerts(specialty: string | null, studentIds: string[], studentNames: Map<string, string>) {
  const { user } = useAuth();
  const planTable = specialty === "nutricionista" ? "diet_plans" : "training_plans";
  const enabled = !!user && studentIds.length > 0;

  return useQuery({
    queryKey: ["proactive-alerts", specialty, studentIds],
    queryFn: async () => {
      const alerts: ProactiveAlert[] = [];
      const today = new Date();

      // Parallel fetch: anamneses, plans, workouts (last 14 days), profiles, assessments, subscriptions, subscription_plans
      const [anamneseRes, plansRes, workoutsRes, profilesRes, assessmentsRes, subsRes, subPlansRes] = await Promise.all([
        supabase
          .from("anamnese")
          .select("id, user_id, created_at, reviewed, reviewed_at")
          .in("user_id", studentIds)
          .order("created_at", { ascending: false }),
        supabase
          .from(planTable)
          .select("id, title, user_id, active, valid_until, updated_at")
          .in("user_id", studentIds),
        supabase
          .from("workouts")
          .select("user_id, finished_at")
          .in("user_id", studentIds)
          .gte("started_at", new Date(today.getTime() - 14 * 86400000).toISOString())
          .not("finished_at", "is", null),
        supabase
          .from("profiles")
          .select("id, status, onboarded")
          .in("id", studentIds),
        supabase
          .from("monthly_assessments")
          .select("user_id, created_at")
          .in("user_id", studentIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("subscriptions")
          .select("user_id, started_at, plan_price, status")
          .in("user_id", studentIds)
          .eq("status", "active"),
        supabase
          .from("subscription_plans")
          .select("price, duration_months")
          .eq("active", true),
      ]);

      const anamneses = anamneseRes.data ?? [];
      const plans = plansRes.data ?? [];
      const workouts = workoutsRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const assessments = assessmentsRes.data ?? [];
      const subscriptions = subsRes.data ?? [];
      const subPlans = subPlansRes.data ?? [];

      // Build price -> duration map
      const priceToDuration = new Map<number, number>();
      for (const sp of subPlans) {
        priceToDuration.set(Number(sp.price), sp.duration_months);
      }

      // Map subscription expiry per student
      const subscriptionExpiry = new Map<string, Date>();
      for (const sub of subscriptions) {
        const duration = priceToDuration.get(sub.plan_price) ?? 1; // default 1 month
        const expiry = addMonths(new Date(sub.started_at), duration);
        const existing = subscriptionExpiry.get(sub.user_id);
        if (!existing || expiry > existing) {
          subscriptionExpiry.set(sub.user_id, expiry);
        }
      }

      // Group latest anamnese per student
      const latestAnamnese = new Map<string, typeof anamneses[0]>();
      for (const a of anamneses) {
        if (!latestAnamnese.has(a.user_id)) latestAnamnese.set(a.user_id, a);
      }

      // Group active plans per student
      const activePlansByStudent = new Map<string, typeof plans[0]>();
      for (const p of plans) {
        if (p.active) {
          const existing = activePlansByStudent.get(p.user_id);
          if (!existing) activePlansByStudent.set(p.user_id, p);
        }
      }

      // Students with recent workouts
      const studentsWithWorkouts = new Set(workouts.map((w) => w.user_id));

      // Latest assessment per student
      const latestAssessment = new Map<string, typeof assessments[0]>();
      for (const a of assessments) {
        if (!latestAssessment.has(a.user_id)) latestAssessment.set(a.user_id, a);
      }

      // Profile status map
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      for (const sid of studentIds) {
        const name = studentNames.get(sid) ?? "Aluno";
        const profile = profileMap.get(sid);
        const anam = latestAnamnese.get(sid);
        const plan = activePlansByStudent.get(sid);

        // 1. Onboarding pendente
        if (profile && (profile.status === "pendente_onboarding" || !profile.onboarded)) {
          alerts.push({
            id: `onboarding-${sid}`,
            type: "onboarding_pending",
            studentId: sid,
            studentName: name,
            severity: "warning",
            title: "Onboarding pendente",
            daysRelative: 0,
            timeLabel: "aguardando",
            navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
          });
          continue; // skip other alerts for onboarding students
        }

        // 2. Anamnese: review pending (filled but not reviewed)
        if (anam && !anam.reviewed) {
          const daysSince = differenceInCalendarDays(today, new Date(anam.created_at));
          alerts.push({
            id: `anamnese-review-${sid}`,
            type: "anamnese_review_pending",
            studentId: sid,
            studentName: name,
            severity: getSeverity(daysSince, { warn: 1, critical: 3 }),
            title: "Anamnese aguardando revisão",
            daysRelative: daysSince,
            timeLabel: `preenchida ${buildTimeLabel(daysSince, "overdue")}`,
            navigateTo: `/especialista/anamnese/${sid}`,
          });
        }

        // 3. Plan expiring soon or expired
        if (plan && plan.valid_until) {
          const validDate = new Date(plan.valid_until);
          const daysUntil = differenceInCalendarDays(validDate, today);

          if (daysUntil < 0) {
            // Expired
            const daysOverdue = Math.abs(daysUntil);
            alerts.push({
              id: `plan-expired-${sid}`,
              type: "plan_expired",
              studentId: sid,
              studentName: name,
              severity: getSeverity(daysOverdue, { warn: 1, critical: 7 }),
              title: `Plano expirado`,
              daysRelative: daysOverdue,
              timeLabel: `expirou ${buildTimeLabel(daysOverdue, "overdue")}`,
              navigateTo: specialty === "nutricionista"
                ? `/especialista/dietas?aluno=${encodeURIComponent(name)}`
                : `/especialista/treinos?aluno=${encodeURIComponent(name)}`,
            });
          } else if (daysUntil <= 7) {
            // Expiring soon
            alerts.push({
              id: `plan-expiring-${sid}`,
              type: "plan_expiring_soon",
              studentId: sid,
              studentName: name,
              severity: daysUntil <= 2 ? "warning" : "info",
              title: `Plano expira ${buildTimeLabel(daysUntil, "remaining")}`,
              daysRelative: -daysUntil,
              timeLabel: buildTimeLabel(daysUntil, "remaining"),
              navigateTo: specialty === "nutricionista"
                ? `/especialista/dietas?aluno=${encodeURIComponent(name)}`
                : `/especialista/treinos?aluno=${encodeURIComponent(name)}`,
            });
          }
        }

        // 4. No active plan at all
        if (!plan) {
          alerts.push({
            id: `no-plan-${sid}`,
            type: "no_plan",
            studentId: sid,
            studentName: name,
            severity: "warning",
            title: "Sem plano ativo",
            daysRelative: 0,
            timeLabel: "criar plano",
            navigateTo: specialty === "nutricionista"
              ? `/especialista/dietas?aluno=${encodeURIComponent(name)}`
              : `/especialista/treinos?aluno=${encodeURIComponent(name)}`,
          });
        }

        // 5. Inactive - no workouts in 14 days (all specialties)
        if (plan && !studentsWithWorkouts.has(sid)) {
          alerts.push({
            id: `inactive-${sid}`,
            type: "inactive",
            studentId: sid,
            studentName: name,
            severity: "warning",
            title: "Sem treinos há +14 dias",
            daysRelative: 14,
            timeLabel: "inativo",
            navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
          });
        }

        // 6. Assessment overdue - only after 30 days since first anamnese
        const assessment = latestAssessment.get(sid);
        if (profile && profile.onboarded && anam) {
          const daysSinceAnamnese = differenceInCalendarDays(today, new Date(anam.created_at));
          // Only show reassessment alerts if 30+ days have passed since anamnese
          if (daysSinceAnamnese >= 30) {
            if (!assessment) {
              alerts.push({
                id: `assessment-never-${sid}`,
                type: "assessment_overdue",
                studentId: sid,
                studentName: name,
                severity: "warning",
                title: "Reavaliação nunca preenchida",
                daysRelative: daysSinceAnamnese - 30,
                timeLabel: "nunca feita",
                navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
              });
            } else {
              const daysSinceAssessment = differenceInCalendarDays(today, new Date(assessment.created_at));
              if (daysSinceAssessment > 30) {
                alerts.push({
                  id: `assessment-overdue-${sid}`,
                  type: "assessment_overdue",
                  studentId: sid,
                  studentName: name,
                  severity: getSeverity(daysSinceAssessment - 30, { warn: 1, critical: 30 }),
                  title: "Reavaliação mensal pendente",
                  daysRelative: daysSinceAssessment,
                  timeLabel: `última ${buildTimeLabel(daysSinceAssessment, "overdue")}`,
                  navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
                });
              }
            }
          }
        }

        // 7. Churn risk - subscription nearing expiry or overdue
        const expiry = subscriptionExpiry.get(sid);
        if (expiry) {
          const daysUntilExpiry = differenceInCalendarDays(expiry, today);
          if (daysUntilExpiry < 0) {
            // Overdue - subscription expired without renewal
            const daysOverdue = Math.abs(daysUntilExpiry);
            alerts.push({
              id: `churn-overdue-${sid}`,
              type: "churn_risk",
              studentId: sid,
              studentName: name,
              severity: daysOverdue >= 7 ? "critical" : "warning",
              title: "Assinatura vencida",
              daysRelative: daysOverdue,
              timeLabel: `venceu ${buildTimeLabel(daysOverdue, "overdue")}`,
              navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
            });
          } else if (daysUntilExpiry <= 10) {
            // Nearing expiry
            alerts.push({
              id: `churn-expiring-${sid}`,
              type: "churn_risk",
              studentId: sid,
              studentName: name,
              severity: daysUntilExpiry <= 3 ? "warning" : "info",
              title: `Assinatura vence ${buildTimeLabel(daysUntilExpiry, "remaining")}`,
              daysRelative: -daysUntilExpiry,
              timeLabel: `vence ${buildTimeLabel(daysUntilExpiry, "remaining")}`,
              navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
            });
          }
        }
      }

      // Sort: critical first, then warning, then info
      const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return alerts;
    },
    enabled,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });
}
