import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, ClipboardCheck, ArrowUpRight, CheckCircle2, Clock, ExternalLink, Timer, FileWarning, Dumbbell, ClipboardList, CalendarClock, MessageCircleOff, X, ChevronDown, ChevronUp, RotateCcw, XCircle, RefreshCw, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSpecialistStudents } from "@/hooks/useSpecialistStudents";
import { useAllowedRoutes } from "@/hooks/useSpecialtyGuard";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useProactiveAlerts, useDismissAlert, useSuspendedAlerts, type ProactiveAlert, type AlertSeverity, type AlertType } from "@/hooks/useProactiveAlerts";
import { SuspendAlertModal, type SuspendAlertPayload } from "@/components/especialista/SuspendAlertModal";
import { BellOff, CornerUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

const GlassCard = ({ children, className, glow, onClick }: { children: React.ReactNode; className?: string; glow?: "gold" | "crimson" | "teal"; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={cn(
      "relative rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] backdrop-blur-md overflow-hidden",
      className
    )}
  >
    {glow && (
      <div
        className={cn(
          "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none",
          glow === "gold" && "bg-[hsl(var(--gold))]",
          glow === "crimson" && "bg-[hsl(var(--crimson))]",
          glow === "teal" && "bg-[hsl(var(--forja-teal))]"
        )}
      />
    )}
    {children}
  </div>
);

const STALE_DAYS = 30;

interface StalePlanDetail {
  planId: string;
  planTitle: string;
  studentId: string;
  studentName: string;
  daysSinceUpdate: number;
}

function useReviewStats(specialty: string | null, studentIds: string[], studentNames: Map<string, string>) {
  const { user } = useAuth();
  const table = specialty === "nutricionista" ? "diet_plans" : "training_plans";
  const enabled = !!user && studentIds.length > 0 && (specialty === "personal" || specialty === "nutricionista");

  return useQuery({
    queryKey: ["review-stats", specialty, studentIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("id, title, updated_at, active, user_id")
        .in("user_id", studentIds);
      if (error) throw error;

      const now = Date.now();
      const staleMs = STALE_DAYS * 86400000;
      const activePlans = (data ?? []).filter((p) => p.active);
      const stalePlans: StalePlanDetail[] = [];
      let upToDate = 0;

      // Track which students have an active plan
      const studentsWithPlan = new Set<string>();

      for (const p of activePlans) {
        studentsWithPlan.add(p.user_id);
        const elapsed = now - new Date(p.updated_at).getTime();
        if (elapsed > staleMs) {
          stalePlans.push({
            planId: p.id,
            planTitle: p.title,
            studentId: p.user_id,
            studentName: studentNames.get(p.user_id) ?? "Aluno",
            daysSinceUpdate: Math.floor(elapsed / 86400000),
          });
        } else {
          upToDate++;
        }
      }

      // Students without any active plan are also pending
      for (const sid of studentIds) {
        if (!studentsWithPlan.has(sid)) {
          stalePlans.push({
            planId: "",
            planTitle: "Sem plano criado",
            studentId: sid,
            studentName: studentNames.get(sid) ?? "Aluno",
            daysSinceUpdate: 999,
          });
        }
      }

      stalePlans.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
      const total = studentIds.length;
      const efficiency = total > 0 ? Math.round((upToDate / total) * 100) : 100;
      return { total, stale: stalePlans.length, upToDate, efficiency, stalePlans };
    },
    enabled,
  });
}



const EfficiencyBar = ({ percent, label, onClick }: { percent: number; label: string; onClick?: () => void }) => (
  <div className={cn("mt-3", onClick && "cursor-pointer group")} onClick={onClick}>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] text-muted-foreground">
        {label}
        {onClick && <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-[hsl(var(--forja-teal))]">· Ver detalhes</span>}
      </span>
      <span className={cn(
        "text-xs font-bold tabular-nums",
        percent >= 80 ? "text-emerald-400" : percent >= 50 ? "text-amber-400" : "text-destructive"
      )}>{percent}%</span>
    </div>
    <div className="h-2 rounded-full bg-[hsl(var(--glass-highlight))] overflow-hidden">
      <motion.div
        className={cn(
          "h-full rounded-full",
          percent >= 80 ? "bg-emerald-400" : percent >= 50 ? "bg-amber-400" : "bg-destructive"
        )}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
      />
    </div>
  </div>
);

type AlertFilterKey = "all" | AlertType;

const ALERT_FILTER_OPTIONS: { key: AlertFilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "no_plan", label: "Sem plano" },
  { key: "anamnese_review_pending", label: "Anamnese pendente" },
  { key: "monthly_pending", label: "Mensal pendente" },
  { key: "monthly_awaiting_review", label: "Mensal aguardando análise" },
  { key: "onboarding_pending", label: "Onboarding" },
  { key: "assessment_overdue", label: "Reavaliação" },
  { key: "churn_risk", label: "Risco de Churn" },
  { key: "inactive", label: "Inativos" },
  { key: "plan_expired", label: "Plano expirado" },
  { key: "plan_expiring_soon", label: "Expira em breve" },
  { key: "anamnese_not_done", label: "Anamnese não feita" },
];

interface UnresponsiveStudent {
  studentId: string;
  studentName: string;
  daysSinceLastMessage: number;
}

function useUnresponsiveStudents(specialistId: string | undefined, studentIds: string[], studentNames: Map<string, string>) {
  return useQuery({
    queryKey: ["unresponsive-students", specialistId, studentIds],
    queryFn: async () => {
      if (!specialistId || studentIds.length === 0) return [];

      const { data: myConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", specialistId);
      
      if (!myConvs?.length) return [];
      const convIds = myConvs.map(c => c.conversation_id);

      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds)
        .in("user_id", studentIds);

      if (!allParticipants?.length) return [];

      const studentConvMap = new Map<string, string[]>();
      for (const p of allParticipants) {
        const existing = studentConvMap.get(p.user_id) ?? [];
        existing.push(p.conversation_id);
        studentConvMap.set(p.user_id, existing);
      }

      const now = Date.now();
      const sevenDaysMs = 7 * 86400000;
      const unresponsive: UnresponsiveStudent[] = [];

      for (const [studentId, convs] of studentConvMap) {
        // Get the last message in this conversation (from anyone)
        const { data: lastMsgInConv } = await supabase
          .from("chat_messages")
          .select("sender_id, created_at")
          .in("conversation_id", convs)
          .order("created_at", { ascending: false })
          .limit(1);

        const last = lastMsgInConv?.[0];
        if (!last) continue;

        // Only flag if the LAST message was sent by the student (specialist hasn't replied)
        if (last.sender_id !== studentId) continue;

        const elapsed = now - new Date(last.created_at).getTime();
        if (elapsed >= sevenDaysMs) {
          unresponsive.push({
            studentId,
            studentName: studentNames.get(studentId) ?? "Aluno",
            daysSinceLastMessage: Math.floor(elapsed / 86400000),
          });
        }
      }

      unresponsive.sort((a, b) => b.daysSinceLastMessage - a.daysSinceLastMessage);
      return unresponsive;
    },
    enabled: !!specialistId && studentIds.length > 0,
  });
}

const EspecialistaDashboard = () => {
  const navigate = useNavigate();
  const { data: students, isLoading } = useSpecialistStudents();
  const { specialty } = useAllowedRoutes();
  const { user } = useAuth();
  const [detailOpen, setDetailOpen] = useState(false);
  const [unresponsiveOpen, setUnresponsiveOpen] = useState(false);
  const [alertFilter, setAlertFilter] = useState<AlertFilterKey>("all");

  const totalStudents = students?.length ?? 0;
  const studentIds = (students ?? []).map((s) => s.id);
  const studentNames = new Map((students ?? []).map((s) => [s.id, s.name]));

  // reviewStats kept for potential future use but efficiency is now alert-based
  const { data: proactiveAlerts, isLoading: alertsLoading, isFetching: alertsFetching } = useProactiveAlerts(specialty, studentIds, studentNames);
  const { data: unresponsiveStudents } = useUnresponsiveStudents(user?.id, studentIds, studentNames);
  const { dismissOne, dismissAllForStudent, restoreAll, suspendAlert, unsuspendAlert } = useDismissAlert();
  const { data: suspendedAlerts } = useSuspendedAlerts(studentNames);
  const queryClient = useQueryClient();
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [suspendTarget, setSuspendTarget] = useState<ProactiveAlert | null>(null);
  const [suspendedOpen, setSuspendedOpen] = useState(false);

  const SNOOZABLE_TYPES = new Set<AlertType>([
    "anamnese_review_pending",
    "anamnese_not_done",
    "monthly_pending",
    "monthly_awaiting_review",
    "assessment_overdue",
  ]);

  const alertCount = proactiveAlerts?.length ?? 0;
  const unresponsiveCount = unresponsiveStudents?.length ?? 0;
  const filteredAlerts = alertFilter === "all"
    ? (proactiveAlerts ?? [])
    : (proactiveAlerts ?? []).filter((a) => a.type === alertFilter);

  // Group alerts by student
  const groupedAlerts = useMemo(() => {
    const map = new Map<string, ProactiveAlert[]>();
    for (const alert of filteredAlerts) {
      const existing = map.get(alert.studentId) ?? [];
      existing.push(alert);
      map.set(alert.studentId, existing);
    }
    // Sort groups: critical students first
    const entries = Array.from(map.entries());
    const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    entries.sort((a, b) => {
      const aMin = Math.min(...a[1].map(al => severityOrder[al.severity]));
      const bMin = Math.min(...b[1].map(al => severityOrder[al.severity]));
      return aMin - bMin;
    });
    return entries;
  }, [filteredAlerts]);

  const toggleExpanded = (sid: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  };

  const handleDismissOne = (e: React.MouseEvent, alert: ProactiveAlert) => {
    e.stopPropagation();
    dismissOne.mutate({ alertKey: alert.id, studentId: alert.studentId }, {
      onSuccess: () => toast.success("Alerta dispensado"),
    });
  };

  const handleDismissAllStudent = (e: React.MouseEvent, alerts: ProactiveAlert[]) => {
    e.stopPropagation();
    dismissAllForStudent.mutate({ alerts }, {
      onSuccess: () => toast.success(`${alerts.length} alertas dispensados`),
    });
  };

  const handleRestoreAll = () => {
    restoreAll.mutate(undefined, {
      onSuccess: () => toast.success("Alertas restaurados"),
    });
  };

  const handleConfirmSuspend = (payload: SuspendAlertPayload) => {
    if (!suspendTarget) return;
    suspendAlert.mutate(
      {
        alertKey: suspendTarget.id,
        studentId: suspendTarget.studentId,
        reason: payload.reason,
        expiresAt: payload.expiresAt,
      },
      {
        onSuccess: () => {
          toast.success("Aviso suspenso · movido para 'Aguardando Aluno'");
          setSuspendTarget(null);
        },
        onError: () => toast.error("Não foi possível suspender o aviso"),
      }
    );
  };

  const handleUnsuspend = (alertKey: string) => {
    unsuspendAlert.mutate(
      { alertKey },
      {
        onSuccess: () => toast.success("Aviso reativado"),
        onError: () => toast.error("Falha ao reativar"),
      }
    );
  };

  const handleRefreshAlerts = async () => {
    await queryClient.invalidateQueries({ queryKey: ["proactive-alerts"] });
    toast.success("Alertas atualizados");
  };

  const filteredCount = filteredAlerts.length;

  // Only show filter options that have alerts
  const activeFilterOptions = ALERT_FILTER_OPTIONS.filter(
    (f) => f.key === "all" || (proactiveAlerts ?? []).some((a) => a.type === f.key)
  );

  // Efficiency based on alerts: students without any alert = "em dia"
  const studentsWithAlerts = new Set((proactiveAlerts ?? []).map(a => a.studentId));
  const studentsEmDia = totalStudents - studentsWithAlerts.size;
  const studentsPendentes = studentsWithAlerts.size;
  const efficiencyPercent = totalStudents > 0 ? Math.round((studentsEmDia / totalStudents) * 100) : 100;

  const kpis: { label: string; value: string; icon: typeof Users; change: string; glow: "teal" | "crimson" | "gold"; to: string; onClick?: () => void }[] = [
    { label: "Meus Alunos", value: String(totalStudents), icon: Users, change: `${totalStudents} vinculados`, glow: "teal", to: "/especialista/alunos" },
    { label: "Alunos em Alerta", value: String(studentsPendentes), icon: AlertTriangle, change: studentsPendentes > 0 ? `${alertCount} pendências` : "tudo em dia", glow: "crimson", to: "#alertas" },
    { label: "Em Dia", value: String(studentsEmDia), icon: ClipboardCheck, change: `${studentsPendentes} pendente(s)`, glow: studentsEmDia >= studentsPendentes ? "teal" : "gold", to: "#alertas" },
    { label: "Sem Resposta", value: String(unresponsiveCount), icon: MessageCircleOff, change: unresponsiveCount > 0 ? "alunos silenciosos 7d+" : "todos responderam", glow: unresponsiveCount > 0 ? "crimson" : "teal", to: "#", onClick: () => unresponsiveCount > 0 && setUnresponsiveOpen(true) },
  ];

  const getAlertIcon = (type: ProactiveAlert["type"]) => {
    switch (type) {
      case "anamnese_review_pending": return ClipboardList;
      case "anamnese_not_done": return FileWarning;
      case "plan_expiring_soon": case "plan_expired": return Timer;
      case "no_plan": return FileWarning;
      case "inactive": return Dumbbell;
      case "assessment_overdue": return CalendarClock;
      default: return AlertTriangle;
    }
  };

  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical": return { bg: "bg-destructive/8", border: "border-destructive/25", dot: "bg-destructive animate-pulse", badge: "destructive" as const };
      case "warning": return { bg: "bg-amber-500/5", border: "border-amber-500/20", dot: "bg-amber-400", badge: "outline" as const };
      case "info": return { bg: "bg-[hsl(var(--forja-teal)/0.05)]", border: "border-[hsl(var(--forja-teal)/0.2)]", dot: "bg-[hsl(var(--forja-teal))]", badge: "outline" as const };
    }
  };

  const getSeverityLabel = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical": return "Crítico";
      case "warning": return "Atenção";
      case "info": return "Info";
    }
  };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="show" variants={stagger}>
        {/* Header */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Bem-vindo à</p>
            <h1 className="font-cinzel text-2xl sm:text-3xl font-bold gold-text-gradient tracking-wide">FORJA</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Painel de comando · Visão geral dos seus alunos</p>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {kpis.map((k) => (
            <GlassCard
              key={k.label}
              glow={k.glow}
              className="group hover:border-[hsl(var(--glass-highlight))] transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => k.onClick ? k.onClick() : navigate(k.to)}
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    k.glow === "teal" && "bg-[hsl(var(--forja-teal)/0.15)]",
                    k.glow === "crimson" && "bg-[hsl(var(--crimson)/0.15)]",
                    k.glow === "gold" && "bg-[hsl(var(--gold)/0.15)]",
                  )}>
                    <k.icon size={18} className={cn(
                      k.glow === "teal" && "text-[hsl(var(--forja-teal))]",
                      k.glow === "crimson" && "text-[hsl(var(--crimson-glow))]",
                      k.glow === "gold" && "text-[hsl(var(--gold))]",
                    )} />
                  </div>
                  <ArrowUpRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {isLoading || alertsLoading ? (
                  <Skeleton className="h-9 w-16 mb-1" />
                ) : (
                  <p className="text-3xl font-bold text-foreground">{k.value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">{k.change}</p>
              </div>
            </GlassCard>
          ))}
        </motion.div>

        {/* Alerts + Efficiency */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard glow="crimson">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-[hsl(var(--crimson-glow))]" />
                <h3 className="text-sm font-medium text-foreground">Alunos em Alerta</h3>
                <span className="ml-auto min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-destructive/20 text-destructive text-[10px] font-bold">
                  {groupedAlerts.length}
                </span>
                {alertCount > 0 && (
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                      onClick={() => {
                        // Dismiss ALL visible alerts
                        const allAlerts = proactiveAlerts ?? [];
                        if (allAlerts.length === 0) return;
                        dismissAllForStudent.mutate({ alerts: allAlerts }, {
                          onSuccess: () => toast.success(`${allAlerts.length} alertas dispensados`),
                        });
                      }}
                      disabled={dismissAllForStudent.isPending}
                    >
                      <XCircle size={10} />
                      Limpar todos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                      onClick={handleRefreshAlerts}
                      disabled={alertsFetching}
                    >
                      <RefreshCw size={10} className={cn(alertsFetching && "animate-spin")} />
                      Atualizar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <MoreVertical size={12} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem
                          onClick={handleRestoreAll}
                          disabled={restoreAll.isPending}
                          className="text-xs gap-2"
                        >
                          <RotateCcw size={12} />
                          Restaurar dispensados
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
              {/* Filter chips */}
              {alertCount > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {activeFilterOptions.map((f) => {
                    const count = f.key === "all"
                      ? new Set((proactiveAlerts ?? []).map(a => a.studentId)).size
                      : new Set((proactiveAlerts ?? []).filter(a => a.type === f.key).map(a => a.studentId)).size;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setAlertFilter(f.key)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border",
                          alertFilter === f.key
                            ? "bg-[hsl(var(--gold)/0.15)] border-[hsl(var(--gold)/0.4)] text-[hsl(var(--gold))]"
                            : "bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] text-muted-foreground hover:border-[hsl(var(--glass-highlight))]"
                        )}
                      >
                        {f.label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {isLoading || alertsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
                ) : filteredCount === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{alertCount === 0 ? "Nenhum alerta no momento 🎉" : "Nenhum alerta nesta categoria"}</p>
                ) : (
                  groupedAlerts.map(([studentId, studentAlerts]) => {
                    const name = studentNames.get(studentId) ?? "Aluno";
                    const isExpanded = expandedStudents.has(studentId);
                    const worstSeverity = studentAlerts.find(a => a.severity === "critical")
                      ? "critical" as const
                      : studentAlerts.find(a => a.severity === "warning")
                        ? "warning" as const
                        : "info" as const;
                    const styles = getSeverityStyles(worstSeverity);

                    return (
                      <Collapsible key={studentId} open={isExpanded} onOpenChange={() => toggleExpanded(studentId)}>
                        <div className={cn("rounded-lg border transition-all", styles.bg, styles.border)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 cursor-pointer hover:opacity-80 transition-opacity">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={cn("w-2 h-2 rounded-full shrink-0", styles.dot)} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {studentAlerts.map(a => a.title).slice(0, 3).join(" · ")}
                                    {studentAlerts.length > 3 && ` +${studentAlerts.length - 3}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <Badge
                                  variant={styles.badge}
                                  className={cn(
                                    "text-[10px]",
                                    worstSeverity === "warning" && "border-amber-400 text-amber-400",
                                    worstSeverity === "info" && "border-[hsl(var(--forja-teal))] text-[hsl(var(--forja-teal))]"
                                  )}
                                >
                                  {studentAlerts.length}
                                </Badge>
                                <button
                                  onClick={(e) => handleDismissAllStudent(e, studentAlerts)}
                                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Dispensar todos deste aluno"
                                >
                                  <XCircle size={14} />
                                </button>
                                {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 space-y-1.5 border-t border-[hsl(var(--glass-border))] pt-2">
                              {studentAlerts.map((alert) => {
                                const AlertIcon = getAlertIcon(alert.type);
                                const alertStyles = getSeverityStyles(alert.severity);
                                return (
                                  <div
                                    key={alert.id}
                                    className="flex items-center justify-between py-1.5 group"
                                  >
                                    <div
                                      className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                                      onClick={() => alert.navigateTo && navigate(alert.navigateTo)}
                                    >
                                      <AlertIcon size={12} className="text-muted-foreground shrink-0" />
                                      <span className="text-xs text-foreground truncate">{alert.title}</span>
                                      <span className="text-[10px] text-muted-foreground shrink-0">{alert.timeLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0 ml-1">
                                      {SNOOZABLE_TYPES.has(alert.type) && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSuspendTarget(alert);
                                          }}
                                          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400 transition-all"
                                          title="Suspender aviso"
                                        >
                                          <BellOff size={12} />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => handleDismissOne(e, alert)}
                                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                                        title="Dispensar"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })
                )}
              </div>
            </div>
          </GlassCard>

          <GlassCard glow="teal">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck size={16} className="text-[hsl(var(--forja-teal))]" />
                <h3 className="text-sm font-medium text-foreground">Eficácia de Entregas</h3>
              </div>

              {isLoading || alertsLoading ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))]">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-lg font-bold text-foreground tabular-nums">
                          {studentsEmDia}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Em dia</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))]">
                      <Clock size={14} className="text-amber-400 shrink-0" />
                      <div>
                        <p className="text-lg font-bold text-foreground tabular-nums">
                          {studentsPendentes}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Pendentes</p>
                      </div>
                    </div>
                  </div>

                  <EfficiencyBar
                    percent={efficiencyPercent}
                    label="Alunos sem alertas pendentes"
                    onClick={studentsPendentes > 0 ? () => setDetailOpen(true) : undefined}
                  />
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Detail Modal - Students with alerts */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="bg-background border-border max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-cinzel gold-text-gradient">
                Alunos com Pendências
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {studentsPendentes === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Todos os alunos estão em dia 🎉</p>
              ) : (
                Array.from(studentsWithAlerts).map((sid) => {
                  const name = studentNames.get(sid) ?? "Aluno";
                  const studentAlerts = (proactiveAlerts ?? []).filter(a => a.studentId === sid);
                  const hasCritical = studentAlerts.some(a => a.severity === "critical");
                  return (
                    <div
                      key={sid}
                      onClick={() => { setDetailOpen(false); navigate(`/especialista/alunos?aluno=${encodeURIComponent(name)}`); }}
                      className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] cursor-pointer hover:border-[hsl(var(--glass-highlight))] transition-all"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {studentAlerts.map(a => a.title).join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={hasCritical ? "destructive" : "outline"} className={cn(
                          "text-[10px]",
                          !hasCritical && "border-amber-400 text-amber-400"
                        )}>
                          {studentAlerts.length} alerta{studentAlerts.length > 1 ? "s" : ""}
                        </Badge>
                        <ExternalLink size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
        {/* Unresponsive Students Modal */}
        <Dialog open={unresponsiveOpen} onOpenChange={setUnresponsiveOpen}>
          <DialogContent className="bg-background border-border max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-cinzel text-destructive flex items-center gap-2">
                <MessageCircleOff size={18} />
                Alunos Sem Resposta (7d+)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {(unresponsiveStudents ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Todos os alunos responderam recentemente 🎉</p>
              ) : (
                (unresponsiveStudents ?? []).map((s) => (
                  <div
                    key={s.studentId}
                    className="flex items-center justify-between p-3 rounded-lg border border-destructive/25 bg-destructive/5 cursor-pointer hover:border-destructive/40 transition-all"
                  >
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0"
                      onClick={() => { setUnresponsiveOpen(false); navigate(`/especialista/chat`); }}
                    >
                      <div className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          Última mensagem há {s.daysSinceLastMessage} dias
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="destructive" className="text-[10px]">
                        {s.daysSinceLastMessage}d
                      </Badge>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissOne.mutate(
                            { alertKey: `unresponsive-${s.studentId}`, studentId: s.studentId },
                            { onSuccess: () => toast.success("Oculto") }
                          );
                        }}
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        title="Ocultar"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
    </motion.div>
  );
};

export default EspecialistaDashboard;
