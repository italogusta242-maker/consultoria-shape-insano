import { useState, useEffect, useMemo, useCallback } from "react";
import { SFX } from "@/hooks/useSoundEffects";
import { optimisticFlameUpdate } from "@/lib/flameOptimistic";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Brain, Dumbbell, UtensilsCrossed, MessageCircle, TrendingUp, Calendar, AlertTriangle, ClipboardList, ChevronRight, X, Droplets, Plus, Minus, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import InsanoLogo from "@/components/InsanoLogo";
import DailyCheckIn, { type MentalState, mentalStateLabels, type CheckInResult } from "@/components/DailyCheckIn";
import { useIsMobile } from "@/hooks/use-mobile";
import { XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart, BarChart, Bar, Cell, ReferenceLine } from "recharts";
import { useProfile } from "@/hooks/useProfile";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealPerformance } from "@/hooks/useRealPerformance";
import PerformanceDetailModal from "@/components/PerformanceDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import { getToday, getDailyValue, setDailyValue } from "@/lib/dateUtils";
import { useDailyHabits } from "@/hooks/useDailyHabits";
import { useFlameState } from "@/hooks/useFlameState";
import FlameCard from "@/components/FlameCard";
import FlameBanner from "@/components/FlameBanner";
import AnamneseRequestAlert from "@/components/AnamneseRequestAlert";

// ── Daily goals config ──
const dailyGoalsBase = {
  waterGoal: 3,
  sleepGoal: 8,
};
// Limites por grupo (editáveis pelo especialista — mock)
const volumeLimits: Record<string, { min: number; max: number }> = {
  "Peito": { min: 10, max: 20 },
  "Costas": { min: 10, max: 20 },
  "Ombro": { min: 10, max: 20 },
  "Bíceps": { min: 8, max: 16 },
  "Tríceps": { min: 8, max: 16 },
  "Trapézio": { min: 6, max: 14 },
  "Antebraço": { min: 4, max: 10 },
  "Quadríceps": { min: 10, max: 20 },
  "Posterior": { min: 10, max: 20 },
  "Glúteos": { min: 8, max: 16 },
  "Panturrilha": { min: 6, max: 12 },
  "Abdômen": { min: 6, max: 12 },
  "Core": { min: 6, max: 12 },
};

const getVolumeColor = (series: number, active: boolean, min = 10, max = 20) => {
  if (!active) return "hsl(270, 30%, 35%)";
  if (series < min) return "hsl(0, 70%, 45%)";
  if (series <= max) return "hsl(140, 60%, 40%)";
  return "hsl(40, 80%, 50%)";
};

const getVolumeLabel = (series: number, min = 10, max = 20) => {
  if (series < min) return "Abaixo do ideal";
  if (series <= max) return "Faixa ideal";
  return "Acima do ideal";
};

const VolumeTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0].payload;
    const val = payload[0].value;
    const limits = volumeLimits[entry.grupo];
    const min = limits?.min ?? 10;
    const max = limits?.max ?? 20;
    return (
      <div style={{ background: "hsl(0, 0%, 10%)", border: "1px solid hsl(0, 0%, 16%)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "hsl(43, 30%, 85%)" }}>
        <p className="font-semibold">{val} séries</p>
        <p style={{ fontSize: "10px", color: val < min ? "hsl(0, 70%, 55%)" : val <= max ? "hsl(140, 60%, 50%)" : "hsl(40, 80%, 60%)" }}>
          {getVolumeLabel(val, min, max)} ({min}-{max})
        </p>
      </div>
    );
  }
  return null;
};

const VolumeLegend = () => (
  <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(0, 70%, 45%)" }} /> Abaixo</span>
    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(140, 60%, 40%)" }} /> Ideal</span>
    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(40, 80%, 50%)" }} /> Acima</span>
  </div>
);

const VolumeResumoTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0].payload;
    return (
      <div style={{ background: "hsl(0, 0%, 10%)", border: "1px solid hsl(0, 0%, 16%)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "hsl(43, 30%, 85%)" }}>
        <p className="font-semibold">{entry.grupo}: {entry.series} séries totais</p>
        <p style={{ fontSize: "10px", color: "hsl(43, 10%, 55%)" }}>{entry.total} grupos musculares</p>
      </div>
    );
  }
  return null;
};

// ── Citações por estado da chama (shared) ──
import { quotesByState, getDailyQuote } from "@/lib/stoicQuotes";

const hasDietPlan = true;

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = getToday();

  // Real performance data
  const {
    trainingScore,
    dietScore,
    waterScore,
    sleepScore,
    performanceScore,
    volumeDetalhado,
    volumeResumido,
    performanceData,
    performanceData30,
    todaySchedule,
    hasTrainingPlan,
    todayCheckin,
  } = useRealPerformance();

  const { state: flameStateReal, streak: streakReal, adherence: adherenceReal, isLoading: isFlameLoading } = useFlameState();
  
  // Debug: allow cycling through flame states by clicking the streak badge
  const flameStates: Array<"ativa" | "tregua" | "extinta"> = ["ativa", "tregua", "extinta"];
  const [debugFlameIndex, setDebugFlameIndex] = useState<number | null>(null);
  const flameState = debugFlameIndex !== null ? flameStates[debugFlameIndex] : flameStateReal;
  const streak = debugFlameIndex !== null ? (flameStates[debugFlameIndex] === "extinta" ? 0 : 5) : streakReal;
  const adherence = debugFlameIndex !== null ? (flameStates[debugFlameIndex] === "extinta" ? 0 : 75) : adherenceReal;
  const cycleFlameState = () => {
    setDebugFlameIndex((prev) => {
      const next = prev === null ? 0 : (prev + 1) % flameStates.length;
      return next;
    });
  };

  const [showPerformanceModal, setShowPerformanceModal] = useState(false);

  // Daily check-in
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [volumeExpanded, setVolumeExpanded] = useState(false);
  const [volumeFilter, setVolumeFilter] = useState<"all" | "superior" | "inferior">("all");
  const moodToMentalState = (mood: number): MentalState => {
    if (mood >= 5) return "energizado";
    if (mood >= 4) return "focado";
    if (mood >= 3) return "neutro";
    if (mood >= 2) return "cansado";
    return "desanimado";
  };
  const [mentalState, setMentalState] = useState<MentalState>("focado");
  
  useEffect(() => {
    if (todayCheckin?.mood) {
      setMentalState(moodToMentalState(Number(todayCheckin.mood)));
    }
  }, [todayCheckin]);
  
  // Water & meals from database
  const { waterIntake, setWater: setWaterIntake, mealsCompletedCount: mealsCompleted } = useDailyHabits();

  // Fetch diet plan to get real total meals count
  const { data: dietPlanData } = useQuery({
    queryKey: ["diet-plan", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("diet_plans")
        .select("meals")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const totalMealsFromPlan = useMemo(() => {
    if (!dietPlanData?.meals) return 6;
    try {
      return (dietPlanData.meals as any[]).length || 6;
    } catch {
      return 6;
    }
  }, [dietPlanData]);

  const dailyGoals = { ...dailyGoalsBase, totalMeals: totalMealsFromPlan };
  
  const sleepHours = todayCheckin?.sleep_hours ? Number(todayCheckin.sleep_hours) : 0;

  const checkedIn = !!todayCheckin || localStorage.getItem("lastCheckIn") === new Date().toDateString();

  useEffect(() => {
    if (!checkedIn) {
      const timer = setTimeout(() => setShowCheckIn(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [checkedIn]);

  const currentQuote = useMemo(() => getDailyQuote(flameState), [flameState]);

  // Visual styles based on flame state
  const isExtinta = flameState === "extinta";
  const isTregua = flameState === "tregua";
  const cardBg = isExtinta ? "bg-[hsl(var(--dishonor-card))]" : isTregua ? "bg-[hsl(var(--truce-card))]" : "bg-card";
  const cardBorder = isExtinta ? "border-[hsl(var(--dishonor-border))]" : isTregua ? "border-[hsl(var(--truce-border))]" : "border-border";
  const textMuted = "text-muted-foreground";

  // Button gradient based on flame state
  const buttonGradient = isExtinta
    ? "linear-gradient(135deg, hsl(270, 30%, 35%), hsl(270, 35%, 45%))"
    : isTregua
    ? "linear-gradient(135deg, hsl(210, 50%, 40%), hsl(210, 60%, 50%))"
    : "linear-gradient(135deg, hsl(var(--crimson)), hsl(var(--crimson-glow)))";
  const buttonShadow = isExtinta
    ? "0 0 20px hsl(270, 30%, 35%, 0.3)"
    : isTregua
    ? "0 0 20px hsl(210, 50%, 40%, 0.3)"
    : "0 0 20px hsl(var(--crimson) / 0.3)";

  // Chart/progress accent color based on flame state
  const chartColor = isExtinta ? "hsl(270, 25%, 45%)" : isTregua ? "hsl(210, 50%, 50%)" : "hsl(25, 100%, 50%)";
  
  // Progress bar colors for daily goals
  const mealBarColor = isExtinta ? "hsl(270, 25%, 40%)" : isTregua ? "hsl(210, 50%, 45%)" : "hsl(var(--primary))";
  const sleepBarColor = isExtinta ? "hsl(270, 20%, 38%)" : isTregua ? "hsl(210, 40%, 42%)" : "hsl(270, 60%, 50%)";
  const waterBarColor = isExtinta ? "hsl(270, 22%, 42%)" : isTregua ? "hsl(210, 45%, 48%)" : "hsl(220, 60%, 50%)";
  
  // Quote accent color
  const quoteAccent = isExtinta ? "hsl(270, 30%, 50%)" : isTregua ? "hsl(210, 50%, 55%)" : "hsl(var(--accent))";
  const quoteBorder = isExtinta ? "hsl(270, 15%, 18%)" : isTregua ? "hsl(210, 18%, 20%)" : "hsl(var(--border) / 0.5)";
  const quoteTextColor = isExtinta ? "hsl(270, 15%, 60%)" : isTregua ? "hsl(210, 20%, 65%)" : "hsl(var(--foreground) / 0.8)";
  
  // Volume bar color override
  const volumeBarColor = isExtinta ? "hsl(270, 20%, 35%)" : isTregua ? "hsl(210, 40%, 40%)" : "hsl(140, 60%, 40%)";
  
  // Background color based on flame state
  const pageBg = isExtinta ? "hsl(260, 20%, 6%)" : isTregua ? "hsl(210, 25%, 7%)" : undefined;
  
  // Stat badge colors
  const statBorderColor = isExtinta ? "hsl(270, 12%, 18%)" : isTregua ? "hsl(210, 18%, 20%)" : undefined;
  
  // Icon accent color for misc icons (TrendingUp, Droplets, etc.)
  const iconAccentColor = isExtinta ? "hsl(270, 30%, 45%)" : isTregua ? "hsl(210, 50%, 50%)" : undefined;
  const iconAccentClass = isExtinta ? "text-[hsl(270,30%,45%)]" : isTregua ? "text-[hsl(210,50%,50%)]" : "text-accent";
  const dropletsClass = isExtinta ? "text-[hsl(270,25%,45%)]" : isTregua ? "text-[hsl(210,50%,50%)]" : "text-[hsl(220,60%,50%)]";

  const PendingPlanAlert = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`${cardBg} rounded-xl border border-accent/30 p-4`}
    >
      <div className="flex items-center gap-3">
        <Calendar size={20} className="text-accent" />
        <div>
          <p className="font-cinzel text-sm font-bold text-foreground">Seu plano está sendo preparado</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nossa equipe de especialistas está analisando sua anamnese. Prazo: até 72h.
          </p>
        </div>
      </div>
    </motion.div>
  );

  // Fetch real last assessment date
  const { data: lastAssessmentDate } = useQuery({
    queryKey: ["last-assessment"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: monthly } = await supabase
        .from("monthly_assessments" as any)
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (monthly) return new Date((monthly as any).created_at);
      const { data: anamnese } = await supabase
        .from("anamnese")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (anamnese) return new Date(anamnese.created_at);
      return null;
    },
  });
  const daysSinceAnamnese = lastAssessmentDate
    ? Math.floor((Date.now() - lastAssessmentDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const showAnamnese = daysSinceAnamnese >= 30;

  const MonthlyAnamnesisBanner = () => {
    if (!showAnamnese) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} rounded-xl border border-accent/40 p-4 relative z-10`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-accent" />
          </div>
          <div className="flex-1">
            <p className="font-cinzel text-sm font-bold text-foreground">Nova Anamnese Disponível</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Já se passaram {daysSinceAnamnese} dias. Atualize seus dados para otimizar seu plano.
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/reavaliacao")}
          className="w-full mt-3 py-2.5 rounded-lg font-cinzel text-sm font-semibold text-foreground flex items-center justify-center gap-2"
          style={{ background: "hsl(var(--accent) / 0.15)", border: "1px solid hsl(var(--accent) / 0.3)" }}
        >
          <ClipboardList size={16} />
          FAZER ANAMNESE MENSAL
        </motion.button>
      </motion.div>
    );
  };

  const StoicQuote = ({ compact = false }: { compact?: boolean }) => (
    <div className="rounded-xl border p-4 text-center"
      style={{
        background: isExtinta ? "hsl(var(--dishonor-card))" : isTregua ? "hsl(var(--truce-card))" : "hsl(var(--card) / 0.5)",
        borderColor: quoteBorder,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div key={flameState} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
          <p className={`${compact ? "text-xs" : "text-sm"} italic mb-2`}
            style={{ color: quoteTextColor }}
          >
            "{currentQuote.text}"
          </p>
          <p className={`${compact ? "text-[10px]" : "text-xs"} font-cinzel font-semibold`}
            style={{ color: quoteAccent }}
          >
            — {currentQuote.author}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  const statIconColor = isExtinta ? "text-[hsl(270,25%,40%)]" : isTregua ? "text-[hsl(210,40%,45%)]" : "";
  const stats = [
    { icon: Heart, label: "Performance", value: String(performanceScore), sub: "/100", color: statIconColor || "text-primary" },
    { icon: Brain, label: "Mental", value: "---", sub: "", color: statIconColor || "text-accent", dynamic: true },
  ];

  // Show nothing while flame state is loading to prevent flash of wrong state
  if (isFlameLoading) {
    return null;
  }

  // ========== MOBILE LAYOUT ==========
  if (isMobile) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4 relative min-h-screen transition-colors duration-500" style={{ backgroundColor: pageBg }}>
        {/* Flame Banner */}
        <FlameBanner state={flameState} />

        {/* Header */}
        <div className="flex items-center justify-between pt-2 relative z-10">
          <div className="flex items-center gap-3">
            <InsanoLogo size={36} />
            <div>
              <p className={`text-xs ${textMuted}`}>Bem-vindo ao Coliseu</p>
              <h1 className="font-cinzel text-lg font-bold text-foreground">{profile?.nome?.toUpperCase() || "ATLETA"}</h1>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 relative z-10">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`${cardBg} rounded-xl border ${cardBorder} p-3 text-center`}
            >
              <stat.icon size={16} className={stat.color} />
              <p className="font-cinzel text-sm font-bold text-foreground">
                {(stat as any).dynamic ? mentalStateLabels[mentalState].label : stat.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{stat.sub || stat.label}</p>
              {stat.label === "Performance" && (
                <div className="w-full h-2 mt-2 rounded-full overflow-hidden" style={{ backgroundColor: "hsl(0, 0%, 20%)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${performanceScore}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{
                      background: isExtinta
                        ? "linear-gradient(90deg, hsl(270, 20%, 25%), hsl(270, 35%, 45%))"
                        : isTregua
                        ? "linear-gradient(90deg, hsl(200, 50%, 40%), hsl(210, 70%, 55%))"
                        : "linear-gradient(90deg, hsl(25, 100%, 50%), hsl(30, 100%, 55%))",
                    }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Flame Card - Mobile */}
        <FlameCard state={flameState} streak={streak} adherence={adherence} />

        {(!hasTrainingPlan || !hasDietPlan) && <PendingPlanAlert />}

        {/* Battle Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="relative z-10"
        >
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/treinos")}
            disabled={!hasTrainingPlan}
            className="w-full py-4 font-cinzel font-bold text-lg rounded-xl tracking-wider flex items-center justify-center gap-3 disabled:opacity-50"
            style={{
              background: buttonGradient,
              boxShadow: buttonShadow,
              color: "hsl(var(--foreground))",
            }}
          >
            <Dumbbell size={24} />
            {hasTrainingPlan ? "INICIAR TREINO" : "AGUARDANDO PLANO"}
          </motion.button>
          {hasTrainingPlan && todaySchedule.duration && (
            <p className="text-center text-xs text-muted-foreground mt-1.5">
              {todaySchedule.name} · {todaySchedule.duration}
            </p>
          )}
          {hasTrainingPlan && !todaySchedule.duration && (
            <p className="text-center text-xs text-muted-foreground mt-1.5">Dia de Descanso</p>
          )}
        </motion.div>

        {/* Performance Chart */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className={`${cardBg} rounded-xl border ${cardBorder} p-4 relative z-10`}
        >
          <button onClick={() => setShowPerformanceModal(true)} className="w-full text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-cinzel text-sm font-bold text-foreground">Evolução de Performance</h3>
              <span className="text-[10px] text-muted-foreground px-2 py-1 rounded bg-secondary">Ver detalhes →</span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "hsl(0, 0%, 10%)", border: "1px solid hsl(0, 0%, 16%)", borderRadius: "8px", fontSize: "12px", color: "hsl(43, 30%, 85%)" }} />
                  <Area type="monotone" dataKey="score" stroke={chartColor} fill="url(#performanceGradient)" strokeWidth={2} dot={{ fill: chartColor, r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </button>
        </motion.div>

        {/* Volume Semanal - Mobile */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
          className={`${cardBg} rounded-xl border ${cardBorder} p-4 relative z-10`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-cinzel text-sm font-bold text-foreground">Volume Semanal</h3>
            <TrendingUp size={14} className={iconAccentClass} />
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">Séries de trabalho por região</p>
          <div className="space-y-3">
            {volumeResumido.map((r) => {
              const regionItems = volumeDetalhado.filter(v => v.regiao === r.grupo.toLowerCase());
              const totalMax = regionItems.reduce((s, v) => s + (volumeLimits[v.grupo]?.max ?? 20), 0);
              const pct = Math.min((r.series / totalMax) * 100, 100);
              return (
                <button key={r.grupo} onClick={() => { setVolumeFilter(r.grupo.toLowerCase() as "superior" | "inferior"); setVolumeExpanded(true); }}
                  className="w-full p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.grupo}</p>
                      <p className="text-[10px] text-muted-foreground">{r.total} grupos · {r.series} séries totais</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-secondary">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: volumeBarColor }} />
                  </div>
                </button>
              );
            })}
          </div>
          <VolumeLegend />
        </motion.div>

        {/* Volume Expandido Modal - Mobile */}
        <AnimatePresence>
          {volumeExpanded && (() => {
            const filteredVolume = volumeFilter === "all" ? volumeDetalhado : volumeDetalhado.filter(v => v.regiao === volumeFilter);
            return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm p-4 overflow-auto"
            >
              <div className="max-w-lg mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-cinzel text-lg font-bold text-foreground">Volume Semanal Detalhado</h3>
                  <button onClick={() => setVolumeExpanded(false)} className="p-2 rounded-lg bg-secondary/50">
                    <X size={18} className="text-foreground" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Limites definidos pelo especialista</p>
                <div className="flex gap-2 mb-4">
                  {(["superior", "inferior"] as const).map((f) => (
                    <button key={f} onClick={() => setVolumeFilter(f)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition-colors ${volumeFilter === f ? "bg-accent/20 text-accent border border-accent/30" : "bg-secondary/30 text-muted-foreground"}`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={{ height: `${Math.max(filteredVolume.length * 34, 180)}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredVolume} layout="vertical" margin={{ left: 5 }}>
                      <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} domain={[0, 'dataMax + 5']} />
                      <YAxis type="category" dataKey="grupo" tick={{ fontSize: 9, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip content={<VolumeTooltip />} />
                      <Bar dataKey="series" radius={[0, 4, 4, 0]}>
                        {filteredVolume.map((entry, i) => {
                          const limits = volumeLimits[entry.grupo] ?? { min: 10, max: 20 };
                          return <Cell key={i} fill={getVolumeColor(entry.series, true, limits.min, limits.max)} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <VolumeLegend />
                <div className="mt-4 space-y-2">
                  {filteredVolume.map((v) => {
                    const limits = volumeLimits[v.grupo] ?? { min: 10, max: 20 };
                    const color = getVolumeColor(v.series, true, limits.min, limits.max);
                    return (
                      <div key={v.grupo} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-sm text-foreground">{v.grupo}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-foreground">{v.series}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">/ {limits.min}-{limits.max}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Metas Diárias - Mobile */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.39 }}
          className={`${cardBg} rounded-xl border ${cardBorder} p-4 relative z-10`}
        >
          <h3 className="font-cinzel text-sm font-bold text-foreground mb-3">Metas Diárias</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={textMuted}>Refeições</span>
                <span className="text-foreground font-semibold">{mealsCompleted} / {dailyGoals.totalMeals}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-secondary">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((mealsCompleted / dailyGoals.totalMeals) * 100, 100)}%`, background: mealBarColor }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={textMuted}>Sono</span>
                <span className="text-foreground font-semibold">{sleepHours.toFixed(1)}h / {dailyGoals.sleepGoal}h</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-secondary">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((sleepHours / dailyGoals.sleepGoal) * 100, 100)}%`, background: sleepBarColor }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={textMuted}>Água</span>
                <span className="text-foreground font-semibold">{waterIntake.toFixed(1)}L / {dailyGoals.waterGoal}L</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-secondary">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((waterIntake / dailyGoals.waterGoal) * 100, 100)}%`, background: waterBarColor }} />
              </div>
              <div className="flex items-center justify-center gap-3 mt-2">
                <button onClick={() => setWaterIntake(Math.max(0, waterIntake - 0.25))}
                  className="w-7 h-7 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors">
                  <Minus size={14} className="text-foreground" />
                </button>
                <div className="flex items-center gap-1">
                  <Droplets size={14} className={dropletsClass} />
                  <span className="text-xs text-muted-foreground">250ml</span>
                </div>
                <button onClick={() => { setWaterIntake(Math.min(10, waterIntake + 0.25)); try { SFX.waterDrop(); } catch {} }}
                  className="w-7 h-7 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors">
                  <Plus size={14} className="text-foreground" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Aggressive anamnesis request alert (specialist-triggered) */}
        <AnamneseRequestAlert />

        <MonthlyAnamnesisBanner />

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="relative z-10">
          <StoicQuote compact />
        </motion.div>

        <DailyCheckIn
          open={showCheckIn}
          onComplete={async (result) => {
            setMentalState(result.mentalState);
            localStorage.setItem("lastCheckIn", new Date().toDateString());
            setShowCheckIn(false);
            if (user) {
              try {
                await supabase.from("psych_checkins").insert({
                  user_id: user.id,
                  sleep_hours: result.sleepDuration,
                  sleep_quality: result.mentalState === "energizado" ? 4 : result.mentalState === "focado" ? 3 : result.mentalState === "neutro" ? 2 : 1,
                  mood: result.mentalState === "energizado" ? 5 : result.mentalState === "focado" ? 4 : result.mentalState === "neutro" ? 3 : result.mentalState === "cansado" ? 2 : 1,
                  stress: result.mentalState === "desanimado" ? 5 : result.mentalState === "cansado" ? 4 : 3,
                });
                // REGRA 1+2: Cancel flame queries, then inject optimistic update
                await queryClient.cancelQueries({ queryKey: ["flame-state", user.id] });
                optimisticFlameUpdate(queryClient, user.id, { adherenceDelta: 10 });
                // Safe to invalidate checkin caches (not flame-related)
                queryClient.invalidateQueries({ queryKey: ["today-checkin"] });
                queryClient.invalidateQueries({ queryKey: ["last30-checkins"] });
              } catch (e) {
                console.error("Failed to save check-in:", e);
              }
            }
          }}
          onClose={() => setShowCheckIn(false)}
        />
        <PerformanceDetailModal
          open={showPerformanceModal}
          onClose={() => setShowPerformanceModal(false)}
          weekData={performanceData}
          monthData={performanceData30}
        />
      </div>
    );
  }

  // ========== DESKTOP LAYOUT ==========
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 relative min-h-screen transition-colors duration-500" style={{ backgroundColor: pageBg }}>
      {/* Flame Banner - Desktop */}
      <FlameBanner state={flameState} />

      {/* Desktop Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <InsanoLogo size={44} />
          <div>
            <p className={`text-xs ${textMuted}`}>Bem-vindo ao Coliseu</p>
            <h1 className="font-cinzel text-2xl font-bold text-foreground">{profile?.nome?.toUpperCase() || "GLADIADOR"}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className={`flex items-center gap-2 ${cardBg} rounded-lg px-4 py-2 border ${cardBorder}`}>
              <stat.icon size={16} className={stat.color} />
              <div>
                <p className="font-cinzel text-sm font-bold text-foreground">
                  {(stat as any).dynamic ? mentalStateLabels[mentalState].label : stat.value}
                </p>
                <p className={`text-[10px] ${textMuted}`}>{stat.sub || stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-3 gap-6 relative z-10">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Flame Card */}
          <FlameCard state={flameState} streak={streak} adherence={adherence} />
          {/* Aggressive anamnesis request alert (specialist-triggered) */}
          <AnamneseRequestAlert />
          {/* Monthly Anamnesis CTA */}
          <MonthlyAnamnesisBanner />
        </div>

        {/* CENTER COLUMN */}
        <div className="space-y-6">
          {(!hasTrainingPlan || !hasDietPlan) && <PendingPlanAlert />}

          <motion.div>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/treinos")}
              disabled={!hasTrainingPlan}
              className="w-full py-5 font-cinzel font-bold text-xl rounded-xl tracking-wider flex items-center justify-center gap-3 disabled:opacity-50"
              style={{
                background: buttonGradient,
                boxShadow: buttonShadow,
                color: "hsl(var(--foreground))",
              }}
            >
              <Dumbbell size={28} />
              {hasTrainingPlan ? "INICIAR TREINO" : "AGUARDANDO PLANO"}
            </motion.button>
            {hasTrainingPlan && todaySchedule.duration && (
              <p className="text-center text-xs text-muted-foreground mt-1.5">
                {todaySchedule.name} · {todaySchedule.duration}
              </p>
            )}
            {hasTrainingPlan && !todaySchedule.duration && (
              <p className="text-center text-xs text-muted-foreground mt-1.5">Dia de Descanso</p>
            )}
          </motion.div>

          {/* Performance Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className={`${cardBg} rounded-xl border ${cardBorder} p-6`}
          >
            <button onClick={() => setShowPerformanceModal(true)} className="w-full text-left">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-cinzel text-sm font-bold text-foreground">Evolução de Performance</h3>
                <span className="text-[10px] text-muted-foreground px-2 py-1 rounded bg-secondary">Ver detalhes →</span>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="perfGradDesktop" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "hsl(0, 0%, 10%)", border: "1px solid hsl(0, 0%, 16%)", borderRadius: "8px", fontSize: "12px", color: "hsl(43, 30%, 85%)" }} />
                    <Area type="monotone" dataKey="score" stroke={chartColor} fill="url(#perfGradDesktop)" strokeWidth={2} dot={{ fill: chartColor, r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </button>
          </motion.div>

          {/* Stoic Quote */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
            <StoicQuote />
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Volume Semanal */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`${cardBg} rounded-xl border ${cardBorder} p-6`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-cinzel text-sm font-bold text-foreground">Volume Semanal</h3>
              <TrendingUp size={16} className={iconAccentClass} />
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">Séries de trabalho por região</p>
            <div className="space-y-3">
              {volumeResumido.map((r) => {
                const regionItems = volumeDetalhado.filter(v => v.regiao === r.grupo.toLowerCase());
                const totalMax = regionItems.reduce((s, v) => s + (volumeLimits[v.grupo]?.max ?? 20), 0);
                const pct = Math.min((r.series / totalMax) * 100, 100);
                return (
                  <button key={r.grupo} onClick={() => { setVolumeFilter(r.grupo.toLowerCase() as "superior" | "inferior"); setVolumeExpanded(true); }}
                    className="w-full p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">{r.grupo}</p>
                        <p className="text-[10px] text-muted-foreground">{r.total} grupos · {r.series} séries totais</p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-secondary">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: volumeBarColor }} />
                    </div>
                  </button>
                );
              })}
            </div>
            <VolumeLegend />
          </motion.div>

          {/* Volume Expandido Modal - Desktop */}
          <AnimatePresence>
            {volumeExpanded && (() => {
              const filteredVolume = volumeFilter === "all" ? volumeDetalhado : volumeDetalhado.filter(v => v.regiao === volumeFilter);
              return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-6"
                onClick={() => setVolumeExpanded(false)}
              >
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                  className={`${cardBg} rounded-xl border ${cardBorder} p-6 max-w-xl w-full max-h-[80vh] overflow-auto`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-cinzel text-lg font-bold text-foreground">Volume Semanal Detalhado</h3>
                    <button onClick={() => setVolumeExpanded(false)} className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors">
                      <X size={18} className="text-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Limites definidos pelo especialista</p>
                  <div className="flex gap-2 mb-4">
                    {(["superior", "inferior"] as const).map((f) => (
                      <button key={f} onClick={() => setVolumeFilter(f)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition-colors ${volumeFilter === f ? "bg-accent/20 text-accent border border-accent/30" : "bg-secondary/30 text-muted-foreground"}`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div style={{ height: `${Math.max(filteredVolume.length * 34, 180)}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredVolume} layout="vertical" margin={{ left: 10 }}>
                        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} domain={[0, 'dataMax + 5']} />
                        <YAxis type="category" dataKey="grupo" tick={{ fontSize: 10, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} width={75} />
                        <Tooltip content={<VolumeTooltip />} />
                        <Bar dataKey="series" radius={[0, 4, 4, 0]}>
                          {filteredVolume.map((entry, i) => {
                            const limits = volumeLimits[entry.grupo] ?? { min: 10, max: 20 };
                            return <Cell key={i} fill={getVolumeColor(entry.series, true, limits.min, limits.max)} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <VolumeLegend />
                  <div className="mt-4 space-y-2">
                    {filteredVolume.map((v) => {
                      const limits = volumeLimits[v.grupo] ?? { min: 10, max: 20 };
                      const color = getVolumeColor(v.series, true, limits.min, limits.max);
                      return (
                        <div key={v.grupo} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                            <span className="text-sm text-foreground">{v.grupo}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-foreground">{v.series}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">/ {limits.min}-{limits.max}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* Daily Targets */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className={`${cardBg} rounded-xl border ${cardBorder} p-6`}
          >
            <h3 className="font-cinzel text-sm font-bold text-foreground mb-4">Metas Diárias</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className={textMuted}>Refeições</span>
                  <span className="text-foreground font-semibold">{mealsCompleted} / {dailyGoals.totalMeals}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-secondary">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((mealsCompleted / dailyGoals.totalMeals) * 100, 100)}%`, background: mealBarColor }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className={textMuted}>Sono</span>
                  <span className="text-foreground font-semibold">{sleepHours.toFixed(1)}h / {dailyGoals.sleepGoal}h</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-secondary">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((sleepHours / dailyGoals.sleepGoal) * 100, 100)}%`, background: sleepBarColor }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className={textMuted}>Água</span>
                  <span className="text-foreground font-semibold">{waterIntake.toFixed(1)}L / {dailyGoals.waterGoal}L</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-secondary">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((waterIntake / dailyGoals.waterGoal) * 100, 100)}%`, background: waterBarColor }} />
                </div>
                <div className="flex items-center justify-center gap-3 mt-2">
                  <button onClick={() => setWaterIntake(Math.max(0, waterIntake - 0.25))}
                    className="w-7 h-7 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors">
                    <Minus size={14} className="text-foreground" />
                  </button>
                  <div className="flex items-center gap-1">
                    <Droplets size={14} className={dropletsClass} />
                    <span className="text-xs text-muted-foreground">250ml</span>
                  </div>
                  <button onClick={() => { setWaterIntake(Math.min(10, waterIntake + 0.25)); try { SFX.waterDrop(); } catch {} }}
                    className="w-7 h-7 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors">
                    <Plus size={14} className="text-foreground" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Daily Check-In Modal */}
      <DailyCheckIn
        open={showCheckIn}
        onComplete={async (result) => {
          setMentalState(result.mentalState);
          localStorage.setItem("lastCheckIn", new Date().toDateString());
          setShowCheckIn(false);
          if (user) {
            try {
              await supabase.from("psych_checkins").insert({
                user_id: user.id,
                sleep_hours: result.sleepDuration,
                sleep_quality: result.mentalState === "energizado" ? 4 : result.mentalState === "focado" ? 3 : result.mentalState === "neutro" ? 2 : 1,
                mood: result.mentalState === "energizado" ? 5 : result.mentalState === "focado" ? 4 : result.mentalState === "neutro" ? 3 : result.mentalState === "cansado" ? 2 : 1,
                stress: result.mentalState === "desanimado" ? 5 : result.mentalState === "cansado" ? 4 : 3,
              });
              // REGRA 1+2: Cancel flame queries, then inject optimistic update
              await queryClient.cancelQueries({ queryKey: ["flame-state", user.id] });
              optimisticFlameUpdate(queryClient, user.id, { adherenceDelta: 10 });
              // Safe to invalidate checkin caches (not flame-related)
              queryClient.invalidateQueries({ queryKey: ["today-checkin"] });
              queryClient.invalidateQueries({ queryKey: ["last30-checkins"] });
            } catch (e) {
              console.error("Failed to save check-in:", e);
            }
          }
        }}
        onClose={() => setShowCheckIn(false)}
      />
      <PerformanceDetailModal
        open={showPerformanceModal}
        onClose={() => setShowPerformanceModal(false)}
        weekData={performanceData}
        monthData={performanceData30}
      />
    </div>
  );
};

export default Dashboard;
