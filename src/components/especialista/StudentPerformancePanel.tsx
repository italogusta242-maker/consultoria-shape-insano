/**
 * @purpose Inline performance chart for a specific student, shown in expanded card.
 * Shows day/week/month performance scores with area chart and breakdown.
 */
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toLocalDate } from "@/lib/dateUtils";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Dumbbell, UtensilsCrossed, Droplets, Moon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  studentId: string;
  studentName: string;
}

interface DayPerf {
  day: string;
  date: string;
  score: number;
  training: number;
  diet: number;
  water: number;
  sleep: number;
  groupName?: string;
  waterLiters?: number;
  sleepHours?: number;
}

const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function calcTrainingForDay(workouts: any[]): { score: number; groupName: string } {
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
    if (score < 10) score = 10;
  }
  return { score, groupName };
}

function getNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function useStudentPerformance(studentId: string) {
  const queryClient = useQueryClient();

  // Realtime: listen for changes on daily_habits, workouts, psych_checkins for this student
  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`perf-${studentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_habits", filter: `user_id=eq.${studentId}` },
        () => { queryClient.invalidateQueries({ queryKey: ["student-performance-panel", studentId] }); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workouts", filter: `user_id=eq.${studentId}` },
        () => { queryClient.invalidateQueries({ queryKey: ["student-performance-panel", studentId] }); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "psych_checkins", filter: `user_id=eq.${studentId}` },
        () => { queryClient.invalidateQueries({ queryKey: ["student-performance-panel", studentId] }); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [studentId, queryClient]);

  return useQuery({
    queryKey: ["student-performance-panel", studentId],
    queryFn: async () => {
      const thirtyAgo = getNDaysAgo(30);

      const [workoutsRes, habitsRes, checkinsRes] = await Promise.all([
        supabase.from("workouts").select("started_at, exercises, group_name").eq("user_id", studentId).gte("started_at", thirtyAgo).order("started_at", { ascending: true }),
        supabase.from("daily_habits").select("date, water_liters, completed_meals").eq("user_id", studentId).gte("date", toLocalDate(new Date(thirtyAgo))).order("date", { ascending: true }),
        supabase.from("psych_checkins").select("created_at, sleep_hours").eq("user_id", studentId).gte("created_at", thirtyAgo).order("created_at", { ascending: true }),
      ]);

      const workouts = workoutsRes.data ?? [];
      const habits = habitsRes.data ?? [];
      const checkins = checkinsRes.data ?? [];

      const buildData = (numDays: number): DayPerf[] => {
        const now = new Date();
        const days: DayPerf[] = [];
        for (let i = numDays - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dateStr = toLocalDate(d);
          const dayLabel = dayLabels[d.getDay()];

          const dayWorkouts = workouts.filter((w) => w.started_at && toLocalDate(new Date(w.started_at)) === dateStr);
          const dayHabits = habits.find((h) => h.date === dateStr);
          const dayCheckin = checkins.find((c) => toLocalDate(new Date(c.created_at)) === dateStr);

          const t = calcTrainingForDay(dayWorkouts);
          const mealsCount = dayHabits?.completed_meals?.length ?? 0;
          const dietPts = Math.round((mealsCount / 6) * 40);
          const waterLiters = Number(dayHabits?.water_liters ?? 0);
          const waterPts = Math.round(Math.min(waterLiters / 3, 1) * 10);
          const sleepHours = dayCheckin?.sleep_hours ? Number(dayCheckin.sleep_hours) : 0;
          const sleepPts = Math.round(Math.min(sleepHours / 8, 1) * 10);

          days.push({
            day: numDays <= 7 ? dayLabel : `${d.getDate()}/${d.getMonth() + 1}`,
            date: dateStr,
            score: Math.min(100, t.score + dietPts + waterPts + sleepPts),
            training: t.score,
            diet: dietPts,
            water: waterPts,
            sleep: sleepPts,
            groupName: t.groupName || undefined,
            waterLiters,
            sleepHours,
          });
        }
        return days;
      };

      return { today: buildData(1), week: buildData(7), month: buildData(30) };
    },
    enabled: !!studentId,
    staleTime: 60_000, // data stays fresh since realtime handles updates
  });
}

const ScoreBar = ({ label, icon: Icon, value, max, color }: {
  label: string; icon: any; value: number; max: number; color: string;
}) => (
  <div className="flex items-center gap-2">
    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
      <Icon size={12} style={{ color }} />
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-bold text-foreground">{value}/{max}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden bg-secondary">
        <div className="h-full rounded-full transition-all" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  </div>
);

export default function StudentPerformancePanel({ studentId, studentName }: Props) {
  const { data, isLoading } = useStudentPerformance(studentId);
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [selectedDay, setSelectedDay] = useState<DayPerf | null>(null);

  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />;
  if (!data) return <p className="text-xs text-muted-foreground text-center py-3">Sem dados de performance</p>;

  const chartData = period === "today" ? data.today : period === "week" ? data.week : data.month;
  const avgScore = chartData.length > 0 ? Math.round(chartData.reduce((s, d) => s + d.score, 0) / chartData.length) : 0;
  const maxScore = chartData.length > 0 ? Math.max(...chartData.map(d => d.score)) : 0;
  const daysWithTraining = chartData.filter(d => d.training > 0).length;

  // For "today" period, show breakdown directly
  const todayData = data.today[0];

  return (
    <div className="space-y-3">
      {/* Period toggle */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
        {([
          { key: "today", label: "Hoje" },
          { key: "week", label: "7 Dias" },
          { key: "month", label: "30 Dias" },
        ] as const).map((p) => (
          <button
            key={p.key}
            onClick={() => { setPeriod(p.key); setSelectedDay(null); }}
            className={cn(
              "flex-1 py-1.5 rounded-md text-[10px] font-cinzel font-semibold transition-all",
              period === p.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === "today" && todayData ? (
        /* Today breakdown */
        <div className="space-y-2 bg-secondary/20 rounded-xl border border-[hsl(var(--glass-border))] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-cinzel font-bold text-foreground">Performance Hoje</span>
            <span className="text-lg font-bold text-accent">{todayData.score}/100</span>
          </div>
          <ScoreBar label={todayData.groupName ? `Treino (${todayData.groupName})` : "Treino"} icon={Dumbbell} value={todayData.training} max={40} color="hsl(25, 100%, 50%)" />
          <ScoreBar label="Alimentação" icon={UtensilsCrossed} value={todayData.diet} max={40} color="hsl(140, 60%, 40%)" />
          <ScoreBar label={`Água${todayData.waterLiters ? ` (${todayData.waterLiters}L)` : ""}`} icon={Droplets} value={todayData.water} max={10} color="hsl(200, 70%, 50%)" />
          <ScoreBar label={`Sono${todayData.sleepHours ? ` (${todayData.sleepHours}h)` : ""}`} icon={Moon} value={todayData.sleep} max={10} color="hsl(260, 60%, 55%)" />
        </div>
      ) : period !== "today" ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-foreground">{avgScore}</p>
              <p className="text-[9px] text-muted-foreground">Média</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-accent">{maxScore}</p>
              <p className="text-[9px] text-muted-foreground">Máximo</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-primary">{daysWithTraining}</p>
              <p className="text-[9px] text-muted-foreground">Dias treino</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-secondary/20 rounded-xl border border-[hsl(var(--glass-border))] p-2">
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} onClick={(e: any) => {
                  if (e?.activeLabel) {
                    const day = chartData.find(d => d.day === e.activeLabel);
                    if (day) setSelectedDay(selectedDay?.date === day.date ? null : day);
                  }
                }}>
                  <defs>
                    <linearGradient id={`perfGrad-${studentId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(25, 100%, 50%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(25, 100%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: period === "month" ? 7 : 9, fill: "hsl(43, 10%, 55%)" }}
                    axisLine={false}
                    tickLine={false}
                    interval={period === "month" ? 4 : 0}
                  />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} domain={[0, 100]} width={25} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(0, 0%, 10%)", border: "1px solid hsl(0, 0%, 16%)",
                      borderRadius: "8px", fontSize: "11px", color: "hsl(43, 30%, 85%)",
                    }}
                    formatter={(value: number) => [`${value} pts`, "Score"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(25, 100%, 50%)"
                    fill={`url(#perfGrad-${studentId})`}
                    strokeWidth={2}
                    dot={{ fill: "hsl(25, 100%, 55%)", r: period === "month" ? 1.5 : 3, cursor: "pointer" }}
                    activeDot={{ r: 5, fill: "hsl(var(--accent))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Selected day breakdown */}
          <AnimatePresence>
            {selectedDay && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-secondary/20 rounded-xl border border-accent/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-cinzel text-xs font-bold text-foreground">{selectedDay.day} — {selectedDay.date}</h3>
                    <span className="text-sm font-bold text-accent">{selectedDay.score}/100</span>
                  </div>
                  <ScoreBar label={selectedDay.groupName ? `Treino (${selectedDay.groupName})` : "Treino"} icon={Dumbbell} value={selectedDay.training} max={40} color="hsl(25, 100%, 50%)" />
                  <ScoreBar label="Alimentação" icon={UtensilsCrossed} value={selectedDay.diet} max={40} color="hsl(140, 60%, 40%)" />
                  <ScoreBar label={`Água${selectedDay.waterLiters ? ` (${selectedDay.waterLiters}L)` : ""}`} icon={Droplets} value={selectedDay.water} max={10} color="hsl(200, 70%, 50%)" />
                  <ScoreBar label={`Sono${selectedDay.sleepHours ? ` (${selectedDay.sleepHours}h)` : ""}`} icon={Moon} value={selectedDay.sleep} max={10} color="hsl(260, 60%, 55%)" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : null}
    </div>
  );
}
