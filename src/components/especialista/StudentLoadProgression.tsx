/**
 * @purpose Shows load progression chart per exercise for a student.
 * Plots max weight used per exercise over time from workouts.exercises JSON.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  studentId: string;
}

interface ExerciseProgress {
  name: string;
  data: { date: string; fullDate: string; weight: number }[];
  diff: number;
}

export default function StudentLoadProgression({ studentId }: Props) {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["student-load-progression", studentId],
    queryFn: async () => {
      const ninetyAgo = new Date();
      ninetyAgo.setDate(ninetyAgo.getDate() - 90);

      const { data: workouts, error } = await supabase
        .from("workouts")
        .select("finished_at, exercises")
        .eq("user_id", studentId)
        .not("finished_at", "is", null)
        .gte("finished_at", ninetyAgo.toISOString())
        .order("finished_at", { ascending: true });

      if (error) throw error;
      if (!workouts || workouts.length === 0) return [];

      // Build map: exerciseName -> [{date, maxWeight}]
      const exerciseMap = new Map<string, { date: Date; weight: number }[]>();

      for (const w of workouts) {
        const exercises = w.exercises as any[] | null;
        if (!exercises) continue;
        const wDate = new Date(w.finished_at!);

        for (const ex of exercises) {
          const sets = ex.setsData || [];
          let maxWeight = 0;
          for (const s of sets) {
            if (s.done && s.weight && s.weight > maxWeight) {
              maxWeight = s.weight;
            }
          }
          if (maxWeight > 0) {
            const name = ex.name as string;
            if (!exerciseMap.has(name)) exerciseMap.set(name, []);
            exerciseMap.get(name)!.push({ date: wDate, weight: maxWeight });
          }
        }
      }

      // Filter exercises with 2+ data points and build progress
      const result: ExerciseProgress[] = [];
      for (const [name, entries] of exerciseMap) {
        if (entries.length < 2) continue;
        const first = entries[0].weight;
        const last = entries[entries.length - 1].weight;
        result.push({
          name,
          data: entries.map((e) => ({
            date: `${e.date.getDate()}/${e.date.getMonth() + 1}`,
            fullDate: e.date.toLocaleDateString("pt-BR"),
            weight: e.weight,
          })),
          diff: last - first,
        });
      }

      // Sort by most data points
      result.sort((a, b) => b.data.length - a.data.length);
      return result;
    },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;

  if (!data || data.length === 0) {
    return (
      <div className="text-center text-xs text-muted-foreground py-3 flex flex-col items-center gap-1">
        <TrendingUp size={16} className="opacity-50" />
        Dados insuficientes para progressão de cargas (precisa de 2+ treinos por exercício)
      </div>
    );
  }

  const active = selectedExercise
    ? data.find((e) => e.name === selectedExercise) ?? data[0]
    : data[0];

  return (
    <div className="space-y-3">
      {/* Exercise selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {data.slice(0, 8).map((ex) => (
          <button
            key={ex.name}
            onClick={() => setSelectedExercise(ex.name)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all whitespace-nowrap",
              active.name === ex.name
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/30 text-muted-foreground border-[hsl(var(--glass-border))] hover:border-primary/50"
            )}
          >
            {ex.name.length > 18 ? ex.name.slice(0, 18) + "…" : ex.name}
          </button>
        ))}
      </div>

      {/* Diff badge */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] text-muted-foreground">
          {active.data.length} registros · 90 dias
        </p>
        <span className={cn(
          "text-xs font-bold",
          active.diff > 0 ? "text-emerald-400" : active.diff < 0 ? "text-red-400" : "text-muted-foreground"
        )}>
          {active.diff > 0 ? "+" : ""}{active.diff.toFixed(1)} kg
        </span>
      </div>

      {/* Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={active.data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--glass-border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              interval={active.data.length > 10 ? 2 : 0}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={30}
              tickFormatter={(v) => `${v}kg`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(0, 0%, 10%)",
                border: "1px solid hsl(0, 0%, 16%)",
                borderRadius: "8px",
                fontSize: "11px",
                color: "hsl(43, 30%, 85%)",
              }}
              formatter={(value: number) => [`${value} kg`, "Carga Máx"]}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="hsl(var(--gold))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--gold))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
