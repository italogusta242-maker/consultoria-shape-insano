import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, ClipboardCheck, ArrowUpRight, CheckCircle2, Clock, ExternalLink, Timer, FileWarning, Dumbbell, ClipboardList, CalendarClock, MessageCircleOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSpecialistStudents } from "@/hooks/useSpecialistStudents";
import { useAllowedRoutes } from "@/hooks/useSpecialtyGuard";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProactiveAlerts, type ProactiveAlert, type AlertSeverity, type AlertType } from "@/hooks/useProactiveAlerts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const { data: proactiveAlerts, isLoading: alertsLoading } = useProactiveAlerts(specialty, studentIds, studentNames);
  const { data: unresponsiveStudents } = useUnresponsiveStudents(user?.id, studentIds, studentNames);

  const alertCount = proactiveAlerts?.length ?? 0;
  const unresponsiveCount = unresponsiveStudents?.length ?? 0;
  const filteredAlerts = alertFilter === "all"
    ? (proactiveAlerts ?? [])
    : (proactiveAlerts ?? []).filter((a) => a.type === alertFilter);
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
    { label: "Alertas", value: String(alertCount), icon: AlertTriangle, change: alertCount > 0 ? "ações pendentes" : "tudo em dia", glow: "crimson", to: "#alertas" },
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
                <h3 className="text-sm font-medium text-foreground">Alertas</h3>
                <span className="ml-auto min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-destructive/20 text-destructive text-[10px] font-bold">
                  {alertCount}
                </span>
              </div>
              {/* Filter chips */}
              {alertCount > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {activeFilterOptions.map((f) => {
                    const count = f.key === "all" ? alertCount : (proactiveAlerts ?? []).filter((a) => a.type === f.key).length;
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
              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {isLoading || alertsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
                ) : filteredCount === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{alertCount === 0 ? "Nenhum alerta no momento 🎉" : "Nenhum alerta nesta categoria"}</p>
                ) : (
                  filteredAlerts.map((alert) => {
                    const styles = getSeverityStyles(alert.severity);
                    const AlertIcon = getAlertIcon(alert.type);
                    return (
                      <div
                        key={alert.id}
                        onClick={() => alert.navigateTo && navigate(alert.navigateTo)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]",
                          styles.bg, styles.border
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("w-2 h-2 rounded-full shrink-0", styles.dot)} />
                          <AlertIcon size={14} className="text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{alert.studentName}</p>
                            <p className="text-xs text-muted-foreground">{alert.title}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{alert.timeLabel}</p>
                          </div>
                        </div>
                        <Badge
                          variant={styles.badge}
                          className={cn(
                            "text-[10px] shrink-0 ml-2",
                            alert.severity === "warning" && "border-amber-400 text-amber-400",
                            alert.severity === "info" && "border-[hsl(var(--forja-teal))] text-[hsl(var(--forja-teal))]"
                          )}
                        >
                          {getSeverityLabel(alert.severity)}
                        </Badge>
                      </div>
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
                    onClick={() => { setUnresponsiveOpen(false); navigate(`/especialista/chat`); }}
                    className="flex items-center justify-between p-3 rounded-lg border border-destructive/25 bg-destructive/5 cursor-pointer hover:border-destructive/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          Última mensagem há {s.daysSinceLastMessage} dias
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      {s.daysSinceLastMessage}d
                    </Badge>
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
