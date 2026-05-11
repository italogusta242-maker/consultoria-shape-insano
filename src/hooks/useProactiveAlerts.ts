import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  | "churn_risk"
  | "monthly_pending"
  | "monthly_awaiting_review";

export interface ProactiveAlert {
  id: string;
  type: AlertType;
  studentId: string;
  studentName: string;
  severity: AlertSeverity;
  title: string;
  daysRelative: number;
  timeLabel: string;
  navigateTo?: string;
}

function buildTimeLabel(days: number, context: "overdue" | "remaining"): string {
  if (context === "overdue") {
    if (days === 0) return "hoje";
    if (days === 1) return "há 1 dia";
    return `há ${days} dias`;
  }
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}

function getSeverity(daysRelative: number, thresholds: { warn: number; critical: number }): AlertSeverity {
  if (daysRelative >= thresholds.critical) return "critical";
  if (daysRelative >= thresholds.warn) return "warning";
  return "info";
}

export type AlertSnoozeReason = "no_response" | "will_respond_later" | "other";

export interface SuspendedAlertRow {
  alert_key: string;
  student_id: string;
  trainer_alert_status: string;
  trainer_alert_reason: string | null;
  trainer_alert_expires_at: string | null;
}

/** Hook to dismiss / suspend alerts */
export function useDismissAlert() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["proactive-alerts"] });
    qc.invalidateQueries({ queryKey: ["suspended-alerts"] });
  };

  const dismissOne = useMutation({
    mutationFn: async ({ alertKey, studentId }: { alertKey: string; studentId: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("dismissed_alerts" as any).upsert(
        {
          specialist_id: user.id,
          alert_key: alertKey,
          student_id: studentId,
          trainer_alert_status: "dismissed",
          trainer_alert_reason: null,
          trainer_alert_expires_at: null,
        } as any,
        { onConflict: "specialist_id,alert_key" }
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const dismissAllForStudent = useMutation({
    mutationFn: async ({ alerts }: { alerts: ProactiveAlert[] }) => {
      if (!user) throw new Error("Not authenticated");
      const rows = alerts.map((a) => ({
        specialist_id: user.id,
        alert_key: a.id,
        student_id: a.studentId,
        trainer_alert_status: "dismissed",
        trainer_alert_reason: null,
        trainer_alert_expires_at: null,
      }));
      const { error } = await supabase.from("dismissed_alerts" as any).upsert(rows as any, {
        onConflict: "specialist_id,alert_key",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const restoreAll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("dismissed_alerts" as any)
        .delete()
        .eq("specialist_id", user.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Suspend an alert (snooze) with a reason and optional expiry. */
  const suspendAlert = useMutation({
    mutationFn: async ({
      alertKey,
      studentId,
      reason,
      expiresAt,
    }: {
      alertKey: string;
      studentId: string;
      reason: string;
      expiresAt: Date | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("dismissed_alerts" as any).upsert(
        {
          specialist_id: user.id,
          alert_key: alertKey,
          student_id: studentId,
          trainer_alert_status: "suspended",
          trainer_alert_reason: reason,
          trainer_alert_expires_at: expiresAt ? expiresAt.toISOString() : null,
        } as any,
        { onConflict: "specialist_id,alert_key" }
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Unsuspend (return to urgent): just delete the row. */
  const unsuspendAlert = useMutation({
    mutationFn: async ({ alertKey }: { alertKey: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("dismissed_alerts" as any)
        .delete()
        .eq("specialist_id", user.id)
        .eq("alert_key", alertKey);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { dismissOne, dismissAllForStudent, restoreAll, suspendAlert, unsuspendAlert };
}

/** Returns the rows currently suspended (snoozed and not yet expired). */
export function useSuspendedAlerts(studentNames: Map<string, string>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["suspended-alerts", user?.id],
    queryFn: async () => {
      if (!user) return [] as (SuspendedAlertRow & { studentName: string })[];
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("dismissed_alerts" as any)
        .select("alert_key, student_id, trainer_alert_status, trainer_alert_reason, trainer_alert_expires_at")
        .eq("specialist_id", user.id)
        .eq("trainer_alert_status", "suspended")
        .or(`trainer_alert_expires_at.is.null,trainer_alert_expires_at.gt.${nowIso}`);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...(r as SuspendedAlertRow),
        studentName: studentNames.get(r.student_id) ?? "Aluno",
      }));
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  });
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

      const [anamneseRes, plansRes, workoutsRes, profilesRes, assessmentsRes, subsRes, subPlansRes, dismissedRes] = await Promise.all([
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
          .select("id, status, onboarded, next_anamnese_due")
          .in("id", studentIds),
        supabase
          .from("monthly_assessments")
          .select("user_id, created_at, reviewed")
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
        supabase
          .from("dismissed_alerts" as any)
          .select("alert_key")
          .eq("specialist_id", user!.id),
      ]);

      const anamneses = anamneseRes.data ?? [];
      const plans = plansRes.data ?? [];
      const workouts = workoutsRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const assessments = assessmentsRes.data ?? [];
      const subscriptions = subsRes.data ?? [];
      const subPlans = subPlansRes.data ?? [];
      const dismissedKeys = new Set(((dismissedRes.data ?? []) as any[]).map((d: any) => d.alert_key));

      // Filter out cancelled/inactive students
      const cancelledStudentIds = new Set(
        profiles.filter((p) => p.status === "cancelado" || p.status === "inativo").map((p) => p.id)
      );
      const activeStudentIds = studentIds.filter((sid) => !cancelledStudentIds.has(sid));

      // Build price -> duration map
      const priceToDuration = new Map<number, number>();
      for (const sp of subPlans) {
        priceToDuration.set(Number(sp.price), sp.duration_months);
      }

      // Map subscription expiry per student
      const subscriptionExpiry = new Map<string, Date>();
      for (const sub of subscriptions) {
        const duration = priceToDuration.get(sub.plan_price) ?? 1;
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

      const studentsWithWorkouts = new Set(workouts.map((w) => w.user_id));

      const latestAssessment = new Map<string, typeof assessments[0]>();
      for (const a of assessments) {
        if (!latestAssessment.has(a.user_id)) latestAssessment.set(a.user_id, a);
      }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      for (const sid of activeStudentIds) {
        const name = studentNames.get(sid) ?? "Aluno";
        const profile = profileMap.get(sid);
        const anam = latestAnamnese.get(sid);
        const plan = activePlansByStudent.get(sid);

        // 1. Onboarding pendente
        if (profile && (profile.status === "pendente_onboarding" || !profile.onboarded)) {
          const key = `onboarding-${sid}`;
          if (!dismissedKeys.has(key)) {
            alerts.push({
              id: key,
              type: "onboarding_pending",
              studentId: sid,
              studentName: name,
              severity: "warning",
              title: "Onboarding pendente",
              daysRelative: 0,
              timeLabel: "aguardando",
              navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
            });
          }
          continue;
        }

        // 2. Anamnese review pending
        if (anam && !anam.reviewed) {
          const daysSince = differenceInCalendarDays(today, new Date(anam.created_at));
          const key = `anamnese-review-${sid}`;
          if (!dismissedKeys.has(key)) {
            alerts.push({
              id: key,
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
        }

        // 3. Plan expiring/expired
        if (plan && plan.valid_until) {
          const validDate = new Date(plan.valid_until);
          const daysUntil = differenceInCalendarDays(validDate, today);

          if (daysUntil < 0) {
            const daysOverdue = Math.abs(daysUntil);
            const key = `plan-expired-${sid}`;
            if (!dismissedKeys.has(key)) {
              alerts.push({
                id: key, type: "plan_expired", studentId: sid, studentName: name,
                severity: getSeverity(daysOverdue, { warn: 1, critical: 7 }),
                title: `Plano expirado`, daysRelative: daysOverdue,
                timeLabel: `expirou ${buildTimeLabel(daysOverdue, "overdue")}`,
                navigateTo: specialty === "nutricionista"
                  ? `/especialista/dietas?aluno=${encodeURIComponent(name)}`
                  : `/especialista/treinos?aluno=${encodeURIComponent(name)}`,
              });
            }
          } else if (daysUntil <= 7) {
            const key = `plan-expiring-${sid}`;
            if (!dismissedKeys.has(key)) {
              alerts.push({
                id: key, type: "plan_expiring_soon", studentId: sid, studentName: name,
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
        }

        // 4. No active plan
        if (!plan) {
          const key = `no-plan-${sid}`;
          if (!dismissedKeys.has(key)) {
            alerts.push({
              id: key, type: "no_plan", studentId: sid, studentName: name,
              severity: "warning", title: "Sem plano ativo", daysRelative: 0,
              timeLabel: "criar plano",
              navigateTo: specialty === "nutricionista"
                ? `/especialista/dietas?aluno=${encodeURIComponent(name)}`
                : `/especialista/treinos?aluno=${encodeURIComponent(name)}`,
            });
          }
        }

        // 5. Inactive
        if (plan && !studentsWithWorkouts.has(sid)) {
          const key = `inactive-${sid}`;
          if (!dismissedKeys.has(key)) {
            alerts.push({
              id: key, type: "inactive", studentId: sid, studentName: name,
              severity: "warning", title: "Sem treinos há +14 dias",
              daysRelative: 14, timeLabel: "inativo",
              navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
            });
          }
        }

        // 6. Reavaliação — UM ÚNICO alerta por aluno (Single Source of Truth)
        // Prioridade: monthly_awaiting_review > monthly_pending > assessment_overdue
        const assessment = latestAssessment.get(sid);
        const nextDue = (profile as any)?.next_anamnese_due;

        // Prioridade 1: aluno já enviou e o especialista precisa revisar
        const assessmentNeedsReview = assessment && !(assessment as any).reviewed;

        if (assessmentNeedsReview) {
          const daysSinceSubmit = differenceInCalendarDays(today, new Date(assessment!.created_at));
          const key = `monthly-review-${sid}`;
          if (!dismissedKeys.has(key)) {
            alerts.push({
              id: key, type: "monthly_awaiting_review", studentId: sid, studentName: name,
              severity: getSeverity(daysSinceSubmit, { warn: 2, critical: 5 }),
              title: "Mensal aguardando análise", daysRelative: daysSinceSubmit,
              timeLabel: `enviada ${buildTimeLabel(daysSinceSubmit, "overdue")}`,
              navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
            });
          }
        } else if (nextDue) {
          // Prioridade 2: ciclo mensal vencido sem resposta nova
          const dueDate = new Date(nextDue);
          const daysOverdue = differenceInCalendarDays(today, dueDate);
          const cycleHasResponse = assessment && new Date(assessment.created_at) >= dueDate;
          if (daysOverdue >= 0 && !cycleHasResponse) {
            const key = `monthly-pending-${sid}`;
            if (!dismissedKeys.has(key)) {
              alerts.push({
                id: key, type: "monthly_pending", studentId: sid, studentName: name,
                severity: getSeverity(daysOverdue, { warn: 3, critical: 7 }),
                title: "Anamnese mensal não respondida", daysRelative: daysOverdue,
                timeLabel: daysOverdue === 0 ? "vence hoje" : `atrasada ${buildTimeLabel(daysOverdue, "overdue")}`,
                navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
              });
            }
          }
        } else if (profile && profile.onboarded && anam) {
          // Prioridade 3 (legado): nunca houve reavaliação E next_anamnese_due não está setado
          const daysSinceAnamnese = differenceInCalendarDays(today, new Date(anam.created_at));
          if (daysSinceAnamnese >= 30 && !assessment) {
            const key = `assessment-never-${sid}`;
            if (!dismissedKeys.has(key)) {
              alerts.push({
                id: key, type: "assessment_overdue", studentId: sid, studentName: name,
                severity: "warning", title: "Reavaliação nunca preenchida",
                daysRelative: daysSinceAnamnese - 30, timeLabel: "nunca feita",
                navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
              });
            }
          }
        }

        // 7. Churn risk
        const expiry = subscriptionExpiry.get(sid);
        if (expiry) {
          const daysUntilExpiry = differenceInCalendarDays(expiry, today);
          if (daysUntilExpiry < 0) {
            const daysOverdue = Math.abs(daysUntilExpiry);
            const key = `churn-overdue-${sid}`;
            if (!dismissedKeys.has(key)) {
              alerts.push({
                id: key, type: "churn_risk", studentId: sid, studentName: name,
                severity: daysOverdue >= 7 ? "critical" : "warning",
                title: "Assinatura vencida", daysRelative: daysOverdue,
                timeLabel: `venceu ${buildTimeLabel(daysOverdue, "overdue")}`,
                navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
              });
            }
          } else if (daysUntilExpiry <= 10) {
            const key = `churn-expiring-${sid}`;
            if (!dismissedKeys.has(key)) {
              alerts.push({
                id: key, type: "churn_risk", studentId: sid, studentName: name,
                severity: daysUntilExpiry <= 3 ? "warning" : "info",
                title: `Assinatura vence ${buildTimeLabel(daysUntilExpiry, "remaining")}`,
                daysRelative: -daysUntilExpiry,
                timeLabel: `vence ${buildTimeLabel(daysUntilExpiry, "remaining")}`,
                navigateTo: `/especialista/alunos?aluno=${encodeURIComponent(name)}`,
              });
            }
          }
        }
      }

      const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return alerts;
    },
    enabled,
    refetchInterval: 5 * 60 * 1000,
  });
}
