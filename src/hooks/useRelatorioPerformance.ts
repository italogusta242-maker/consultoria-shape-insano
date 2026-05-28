import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Muscle group mapping
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

const regionMap: Record<string, "superior" | "inferior"> = {
  Peito: "superior", Costas: "superior", Ombro: "superior",
  Bíceps: "superior", Tríceps: "superior", Trapézio: "superior", Antebraço: "superior",
  Quadríceps: "inferior", Posterior: "inferior", Glúteos: "inferior",
  Panturrilha: "inferior", Abdômen: "inferior", Core: "inferior",
};

export const useRelatorioPerformance = (studentId: string, startDate: Date, endDate: Date) => {
  // Fix end date to include the whole day
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch student info
  const { data: studentInfo } = useQuery({
    queryKey: ["student-info", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .eq("id", studentId)
        .single();
      if (error) throw error;
      return { ...data, name: data.nome };
    },
    enabled: !!studentId,
  });

  // Fetch Workouts
  const { data: workouts, isLoading: loadingWorkouts } = useQuery({
    queryKey: ["relatorio-workouts", studentId, startDate.toISOString(), endOfDay.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("id, started_at, finished_at, group_name, exercises")
        .eq("user_id", studentId)
        .gte("started_at", startDate.toISOString())
        .lte("started_at", endOfDay.toISOString())
        .order("started_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!studentId,
  });

  // Fetch Mental Checkins
  const { data: checkins, isLoading: loadingCheckins } = useQuery({
    queryKey: ["relatorio-checkins", studentId, startDate.toISOString(), endOfDay.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("psych_checkins")
        .select("created_at, sleep_hours, sleep_quality, mood, stress")
        .eq("user_id", studentId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!studentId,
  });

  // Fetch Weight History (All time)
  const { data: weightHistory, isLoading: loadingWeight } = useQuery({
    queryKey: ["relatorio-weight", studentId],
    queryFn: async () => {
      const { data: assessments } = await supabase
        .from("monthly_assessments")
        .select("created_at, peso")
        .eq("user_id", studentId);
      
      // anamnese table no longer carries `peso` directly (it lives in profiles /
      // dados_extras), so weight history is derived from monthly_assessments only.
      const combined = (assessments || [])
        .filter((x: any) => !!x.peso)
        .map((x: any) => ({
          date: new Date(x.created_at).toISOString().split('T')[0],
          peso: Number(x.peso)
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
      // Remove duplicates by date
      const uniqueMap = new Map<string, number>();
      combined.forEach(item => {
        uniqueMap.set(item.date, item.peso);
      });
      
      return Array.from(uniqueMap.entries()).map(([date, peso]) => ({ date, peso }));
    },
    enabled: !!studentId,
  });

  // Calculate workout days
  const workoutDays = (workouts || []).map(w => new Date(w.started_at));

  // Calculate Volume
  const volumeDetalhado = (() => {
    const counts: Record<string, number> = {};
    for (const w of workouts || []) {
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

  // Calculate Checkin Averages
  const mentalAverages = (() => {
    if (!checkins || checkins.length === 0) return { sleep: 0, mood: 0, stress: 0, count: 0 };
    const sums = checkins.reduce((acc, c) => ({
      sleep: acc.sleep + Number(c.sleep_hours || 0),
      mood: acc.mood + Number(c.mood || 0),
      stress: acc.stress + Number(c.stress || 0),
    }), { sleep: 0, mood: 0, stress: 0 });

    return {
      sleep: (sums.sleep / checkins.length).toFixed(1),
      mood: (sums.mood / checkins.length).toFixed(1),
      stress: (sums.stress / checkins.length).toFixed(1),
      count: checkins.length,
    };
  })();

  // Extract Load Progression Data (Exercises list and their history)
  const progressionData = (() => {
    const exMap = new Map<string, { date: string, weight: number }[]>();
    for (const w of workouts || []) {
      const exercises = w.exercises as any[];
      if (!exercises) continue;
      for (const ex of exercises) {
        if (!ex.name) continue;
        const name = ex.name.trim();
        const sets = ex.setsData || [];
        const doneSets = sets.filter((s: any) => s.done && Number(s.weight) > 0);
        if (doneSets.length > 0) {
          // Average weight of done sets for this exercise on this day
          const avgWeight = doneSets.reduce((sum: number, s: any) => sum + Number(s.weight), 0) / doneSets.length;
          const history = exMap.get(name) || [];
          history.push({
            date: new Date(w.started_at).toISOString().split('T')[0],
            weight: Number(avgWeight.toFixed(1))
          });
          exMap.set(name, history);
        }
      }
    }
    // Calculate general average (Geral)
    const generalHistoryMap = new Map<string, { totalWeight: number, count: number }>();
    for (const w of workouts || []) {
      const dateStr = new Date(w.started_at).toISOString().split('T')[0];
      const exercises = w.exercises as any[];
      if (!exercises) continue;
      
      let dayTotalWeight = 0;
      let daySetCount = 0;

      for (const ex of exercises) {
        const sets = ex.setsData || [];
        const doneSets = sets.filter((s: any) => s.done && Number(s.weight) > 0);
        if (doneSets.length > 0) {
          dayTotalWeight += doneSets.reduce((sum: number, s: any) => sum + Number(s.weight), 0);
          daySetCount += doneSets.length;
        }
      }

      if (daySetCount > 0) {
        const existing = generalHistoryMap.get(dateStr) || { totalWeight: 0, count: 0 };
        existing.totalWeight += dayTotalWeight;
        existing.count += daySetCount;
        generalHistoryMap.set(dateStr, existing);
      }
    }

    const generalHistory = Array.from(generalHistoryMap.entries())
      .map(([date, data]) => ({
        date,
        weight: Number((data.totalWeight / data.count).toFixed(1))
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Convert to array and filter out exercises with only 1 data point (no progression)
    const individual = Array.from(exMap.entries())
      .map(([name, history]) => ({ name, history: history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) }))
      .filter(ex => ex.history.length > 1)
      .sort((a, b) => b.history.length - a.history.length); // Sort by most history points

    if (generalHistory.length > 1) {
      individual.unshift({ name: "Geral (Média de todos)", history: generalHistory });
    }

    return individual;
  })();

  // Generate Insights
  const insights = (() => {
    const list: { type: "positive" | "negative" | "warning" | "neutral", text: string }[] = [];
    
    // Training Frequency
    const daysInPeriod = Math.max(1, Math.round((endOfDay.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const freq = (workoutDays.length / daysInPeriod) * 100;
    if (freq >= 70) list.push({ type: "positive", text: `Excelente frequência: treinou em ${Math.round(freq)}% dos dias selecionados.` });
    else if (freq < 40) list.push({ type: "negative", text: `Baixa frequência: treinou apenas ${Math.round(freq)}% dos dias. Pode comprometer os resultados.` });

    // Sleep
    const sleep = Number(mentalAverages.sleep);
    if (sleep > 0 && sleep < 6) list.push({ type: "negative", text: `Sono médio muito baixo (${sleep}h). Alerta para recuperação prejudicada.` });
    else if (sleep >= 7) list.push({ type: "positive", text: `Sono adequado (${sleep}h em média). Boa recuperação.` });

    // Volume Analysis
    let overtrained = false;
    let undertrained = false;
    // We assume a 4 week period for limits (which are weekly limits * weeks). 
    // Let's approximate weeks:
    const weeks = Math.max(1, daysInPeriod / 7);
    
    volumeDetalhado.forEach(v => {
      // Mock limits (using 10-20 weekly as average per muscle group)
      const minWeekly = 8;
      const maxWeekly = 20;
      const actualWeekly = v.series / weeks;
      
      if (actualWeekly > maxWeekly + 4) {
        list.push({ type: "warning", text: `Volume de ${v.grupo} está muito alto (${Math.round(actualWeekly)} séries/semana). Risco de overtraining.` });
        overtrained = true;
      }
      if (actualWeekly > 0 && actualWeekly < minWeekly - 2) {
        undertrained = true;
      }
    });

    if (undertrained && !overtrained) {
       list.push({ type: "neutral", text: `Alguns grupos musculares estão com volume abaixo do ideal (< 8 séries/semana).` });
    }

    if (list.length === 0) list.push({ type: "neutral", text: "Nenhum insight crítico no período." });

    return list;
  })();

  return {
    studentInfo,
    workouts,
    workoutDays,
    checkins,
    mentalAverages,
    volumeDetalhado,
    volumeResumido,
    progressionData,
    weightHistory,
    insights,
    isLoading: loadingWorkouts || loadingCheckins || loadingWeight,
  };
};
