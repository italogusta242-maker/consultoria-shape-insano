/**
 * @purpose Shows daily meal completion log for a student.
 * Displays how many meals were completed each day as a timeline.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Apple, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  studentId: string;
}

export default function StudentDailyMealLog({ studentId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-daily-meal-log", studentId],
    queryFn: async () => {
      // Get active diet plan for expected meal count
      const { data: dietPlan, error: dietError } = await supabase
        .from("diet_plans")
        .select("meals")
        .eq("user_id", studentId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dietError) throw dietError;

      const expectedMeals = dietPlan?.meals as any[] | null;
      const expectedCount = expectedMeals?.length ?? 0;
      const mealNames = expectedMeals?.map((m: any) => m.name as string) ?? [];

      // Get last 14 days of habits
      const fourteenAgo = new Date();
      fourteenAgo.setDate(fourteenAgo.getDate() - 14);

      const { data: habits, error: habitsError } = await supabase
        .from("daily_habits")
        .select("date, completed_meals")
        .eq("user_id", studentId)
        .gte("date", fourteenAgo.toISOString().split("T")[0])
        .order("date", { ascending: false })
        .limit(14);

      if (habitsError) throw habitsError;

      return {
        expectedCount,
        mealNames,
        days: (habits ?? []).map((h) => ({
          date: h.date,
          completedMeals: (h.completed_meals as string[]) || [],
          completedCount: ((h.completed_meals as string[]) || []).length,
        })),
      };
    },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  if (!data || data.days.length === 0) {
    return (
      <div className="text-center text-xs text-muted-foreground py-3 flex flex-col items-center gap-1">
        <Apple size={16} className="opacity-50" />
        Nenhum registro alimentar encontrado
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
      {data.days.map((day) => {
        const date = new Date(day.date + "T12:00:00");
        const ratio = data.expectedCount > 0
          ? day.completedCount / data.expectedCount
          : 0;

        return (
          <div
            key={day.date}
            className="bg-secondary/20 rounded-xl border border-[hsl(var(--glass-border))] p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground">
                {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" })}
              </p>
              <div className={cn(
                "px-2 py-0.5 rounded-lg text-[10px] font-bold",
                ratio >= 1 ? "bg-emerald-500/15 text-emerald-400" :
                ratio >= 0.6 ? "bg-amber-500/15 text-amber-400" :
                "bg-red-500/15 text-red-400"
              )}>
                {day.completedCount}/{data.expectedCount} refeições
              </div>
            </div>

            {/* Per-meal status */}
            {data.mealNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.mealNames.map((mealName) => {
                  const done = day.completedMeals.includes(mealName);
                  return (
                    <span
                      key={mealName}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium",
                        done
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/10 text-red-400/70"
                      )}
                    >
                      {done ? <Check size={8} /> : <X size={8} />}
                      {mealName.length > 15 ? mealName.slice(0, 15) + "…" : mealName}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
