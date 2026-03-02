import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toLocalDate } from "@/lib/dateUtils";
import { useDailyHabitsRange } from "@/hooks/useDailyHabits";

// ── Muscle group mapping by keyword ──
const muscleGroupKeywords: Record<string, string[]> = {
  Peito: ["supino", "crucifixo", "crossover", "peck", "fly"],
  Costas: ["puxada", "remada", "pulldown", "serrote", "pull up", "barra fixa", "graviton"],
  Ombro: ["desenvolvimento", "elevação lateral", "face pull", "arnold", "militar", "ombro"],
  Bíceps: ["rosca", "bíceps", "biceps", "scott"],
  Tríceps: ["tríceps", "triceps", "testa", "francês", "polia"],
  Trapézio: ["trapézio", "encolhimento"],
  Antebraço: ["antebraço", "wrist"],
  Quadríceps: ["agachamento", "leg press", "leg 45", "extensora", "hack", "búlgaro", "passada", "afundo"],
  Posterior: ["mesa flexora", "cadeira flexora", "stiff", "romeno", "posterior"],
  Glúteos: ["abdutora", "glúteo", "hip thrust", "elevação pélvica"],
  Panturrilha: ["panturrilha", "gêmeos"],
  Abdômen: ["abdominal", "crunch", "prancha"],
  Core: ["core", "lombar"],
};

export function mapExerciseToGroup(name: string): string {
  const lower = name.toLowerCase();
  for (const [group, keywords] of Object.entries(muscleGroupKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) return group;
  }
  return "Outro";
}

// ── Types ──
export interface VolumeEntry {
  grupo: string;
  series: number;
  regiao: "superior" | "inferior";
}

export interface DayPerformance {
  day: string;
  date: string;
  score: number;
  training: number;
  diet: number;
  water: number;
  sleep: number;
  groupName?: string;
  setsCompleted?: number;
  totalSets?: number;
  mealsCompleted?: number;
  totalMeals?: number;
  waterLiters?: number;
  sleepHours?: number;
}

const regionMap: Record<string, "superior" | "inferior"> = {
  Peito: "superior", Costas: "superior", Ombro: "superior",
  Bíceps: "superior", Tríceps: "superior", Trapézio: "superior", Antebraço: "superior",
  Quadríceps: "inferior", Posterior: "inferior", Glúteos: "inferior",
  Panturrilha: "inferior", Abdômen: "inferior", Core: "inferior",
};

const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const start = new Date(now.getFullYear(), now.getMonth(), diff);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function getNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Helper: compute training score for a set of workouts
function calcTrainingForDay(workouts: any[]): { score: number; setsCompleted: number; totalSets: number; groupName: string } {
  let totalSets = 0;
  let doneSets = 0;
  let groupName = "";
  for (const w of workouts) {
    if (w.group_name) groupName = w.group_name;
    const exercises = w.exercises as any[];
    if (!exercises) continue;
    for (const ex of exercises) {
      const sets = ex.setsData || [];
      totalSets += sets.length;
      doneSets += sets.filter((s: any) => s.done).length;
    }
  }
  let score = 0;
  if (workouts.length > 0 && totalSets > 0) {
    score = Math.round((doneSets / totalSets) * 40);
    if (score < 10 && workouts.length > 0) score = 10;
  }
  return { score, setsCompleted: doneSets, totalSets, groupName };
}

export const useRealPerformance = () => {
  const { user } = useAuth();
  const today = toLocalDate(new Date());
  const { data: habitsRange = [] } = useDailyHabitsRange(30);

  // Fetch workouts from this week (for volume)
  const { data: weekWorkouts } = useQuery({
    queryKey: ["week-workouts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("workouts")
        .select("started_at, exercises, group_name")
        .eq("user_id", user.id)
        .gte("started_at", getWeekStart())
        .order("started_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch workouts from last 30 days (for chart)
  const { data: last30Workouts } = useQuery({
    queryKey: ["last30-workouts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("workouts")
        .select("started_at, exercises, group_name")
        .eq("user_id", user.id)
        .gte("started_at", getNDaysAgo(30))
        .order("started_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch checkins from last 30 days
  const { data: last30Checkins } = useQuery({
    queryKey: ["last30-checkins", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("psych_checkins")
        .select("created_at, sleep_hours, sleep_quality, mood, stress")
        .eq("user_id", user.id)
        .gte("created_at", getNDaysAgo(30))
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch today's training plan
  const { data: activePlan } = useQuery({
    queryKey: ["active-plan", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("training_plans")
        .select("groups")
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

  // Today's checkin
  const todayCheckin = (last30Checkins ?? []).find(
    (c) => toLocalDate(new Date(c.created_at)) === today
  );

  // ── Helper ──
  const workoutLocalDate = (w: { started_at: string | null }) => {
    if (!w.started_at) return "";
    return toLocalDate(new Date(w.started_at));
  };

  // ── Calculate today's scores ──
  const todayWorkouts = (weekWorkouts ?? []).filter(
    (w) => workoutLocalDate(w) === today
  );

  const todayTraining = calcTrainingForDay(todayWorkouts);
  const trainingScore = todayTraining.score;

  const todayHabits = habitsRange.find((h) => h.date === today);

  const dietScore = (() => {
    const mealsCount = todayHabits?.completed_meals?.length ?? 0;
    return Math.round((mealsCount / 6) * 40);
  })();

  const waterScore = (() => {
    const liters = todayHabits?.water_liters ?? 0;
    return Math.round(Math.min(Number(liters) / 3, 1) * 10);
  })();

  const sleepScore = (() => {
    const hours = todayCheckin?.sleep_hours ?? 0;
    return Math.round(Math.min(Number(hours) / 8, 1) * 10);
  })();

  const performanceScore = Math.min(100, trainingScore + dietScore + waterScore + sleepScore);

  // ── Volume Semanal ──
  const volumeDetalhado: VolumeEntry[] = (() => {
    const counts: Record<string, number> = {};
    for (const w of weekWorkouts ?? []) {
      const exercises = w.exercises as any[];
      if (!exercises) continue;
      for (const ex of exercises) {
        const group = mapExerciseToGroup(ex.name || "");
        if (group === "Outro") continue;
        const sets = ex.setsData || [];
        const doneSets = sets.filter((s: any) => s.done).length;
        counts[group] = (counts[group] || 0) + doneSets;
      }
    }
    return Object.keys(regionMap).map((grupo) => ({
      grupo,
      series: counts[grupo] || 0,
      regiao: regionMap[grupo],
    }));
  })();

  const volumeResumido = [
    {
      grupo: "Superior",
      series: volumeDetalhado.filter((v) => v.regiao === "superior").reduce((s, v) => s + v.series, 0),
      total: volumeDetalhado.filter((v) => v.regiao === "superior").length,
    },
    {
      grupo: "Inferior",
      series: volumeDetalhado.filter((v) => v.regiao === "inferior").reduce((s, v) => s + v.series, 0),
      total: volumeDetalhado.filter((v) => v.regiao === "inferior").length,
    },
  ];

  // ── Build performance data for N days ──
  const buildPerformanceData = (numDays: number): DayPerformance[] => {
    const now = new Date();
    const days: DayPerformance[] = [];

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = toLocalDate(d);
      const dayLabel = dayLabels[d.getDay()];

      const dayWorkouts = (last30Workouts ?? []).filter((w) => workoutLocalDate(w) === dateStr);
      const dayCheckin = (last30Checkins ?? []).find(
        (c) => toLocalDate(new Date(c.created_at)) === dateStr
      );

      const training = calcTrainingForDay(dayWorkouts);

      // Diet & Water from database
      const dayHabits = habitsRange.find((h) => h.date === dateStr);
      let dietPts = 0;
      let mealsCompleted = 0;
      if (dayHabits?.completed_meals) {
        mealsCompleted = dayHabits.completed_meals.length;
        dietPts = Math.round((mealsCompleted / 6) * 40);
      }

      let waterPts = 0;
      let waterLiters = 0;
      if (dayHabits?.water_liters) {
        waterLiters = Number(dayHabits.water_liters);
        waterPts = Math.round(Math.min(waterLiters / 3, 1) * 10);
      }

      // Sleep from DB
      let sleepPts = 0;
      const sleepHours = dayCheckin?.sleep_hours ? Number(dayCheckin.sleep_hours) : 0;
      sleepPts = Math.round(Math.min(sleepHours / 8, 1) * 10);

      const score = Math.min(100, training.score + dietPts + waterPts + sleepPts);

      days.push({
        day: numDays <= 7 ? dayLabel : `${d.getDate()}/${d.getMonth() + 1}`,
        date: dateStr,
        score,
        training: training.score,
        diet: dietPts,
        water: waterPts,
        sleep: sleepPts,
        groupName: training.groupName || undefined,
        setsCompleted: training.setsCompleted,
        totalSets: training.totalSets,
        mealsCompleted,
        totalMeals: 6,
        waterLiters,
        sleepHours,
      });
    }

    return days;
  };

  const performanceData = buildPerformanceData(7);
  const performanceData30 = buildPerformanceData(30);

  // ── Today's schedule from real plan ──
  const todaySchedule = (() => {
    if (!activePlan) return { name: "Sem plano", duration: null };
    const groups = activePlan.groups as any[];
    if (!groups || groups.length === 0) return { name: "Sem plano", duration: null };

    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0) return { name: "Descanso", duration: null };

    const groupIndex = (dayOfWeek - 1) % groups.length;
    if (dayOfWeek - 1 >= groups.length) return { name: "Descanso", duration: null };

    const group = groups[groupIndex];
    return { name: group?.name || "Treino", duration: null };
  })();

  const hasTrainingPlan = !!activePlan;

  return {
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
    todayWorkouts,
    todayCheckin,
  };
};