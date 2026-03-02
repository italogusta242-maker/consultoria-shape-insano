/**
 * @purpose Shows recent workout summaries for specialist view: group, duration, volume, effort, comment.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Dumbbell, Clock, Flame, MessageSquare, Weight } from "lucide-react";

interface Props {
  studentId: string;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60}m` : `${m}min`;
}

function calcVolume(exercises: any[]): number {
  if (!exercises) return 0;
  let total = 0;
  for (const ex of exercises) {
    const sets = ex.setsData || [];
    for (const s of sets) {
      if (s.done && s.weight && s.actualReps) {
        total += s.weight * s.actualReps;
      }
    }
  }
  return total;
}

export default function StudentWorkoutSummary({ studentId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-workout-summary", studentId],
    queryFn: async () => {
      const { data: workouts, error } = await supabase
        .from("workouts")
        .select("id, group_name, started_at, finished_at, duration_seconds, effort_rating, comment, exercises")
        .eq("user_id", studentId)
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return workouts ?? [];
    },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  if (!data || data.length === 0) {
    return (
      <div className="text-center text-xs text-muted-foreground py-3 flex flex-col items-center gap-1">
        <Dumbbell size={16} className="opacity-50" />
        Nenhum treino concluído
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
      {data.map((w) => {
        const date = new Date(w.finished_at!);
        const duration = w.duration_seconds ?? 0;
        const exercises = w.exercises as any[] | null;
        const volume = calcVolume(exercises ?? []);
        const exerciseCount = exercises?.length ?? 0;

        return (
          <div
            key={w.id}
            className="bg-secondary/20 rounded-xl border border-[hsl(var(--glass-border))] p-3 space-y-2"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">{w.group_name || "Treino"}</p>
                <p className="text-[9px] text-muted-foreground">
                  {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  {" · "}
                  {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {w.effort_rating && (
                <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg">
                  <Flame size={11} className="text-primary" />
                  <span className="text-[10px] font-bold text-primary">{w.effort_rating}/10</span>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock size={10} /> {formatDuration(duration)}
              </span>
              <span className="flex items-center gap-1">
                <Dumbbell size={10} /> {exerciseCount} exercícios
              </span>
              {volume > 0 && (
                <span className="flex items-center gap-1">
                  <Weight size={10} /> {(volume / 1000).toFixed(1)}t
                </span>
              )}
            </div>

            {/* Comment / observation */}
            {w.comment && (
              <div className="flex items-start gap-1.5 bg-secondary/30 rounded-lg p-2">
                <MessageSquare size={10} className="text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">{w.comment}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
