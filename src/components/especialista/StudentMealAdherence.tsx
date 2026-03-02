/**
 * @purpose Shows per-meal adherence percentage bars for a student.
 * Compares completed_meals from daily_habits against diet_plan meals
 * to show how consistently the student follows each meal.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  studentId: string;
}

interface MealAdherenceData {
  mealName: string;
  completedDays: number;
  totalDays: number;
  percentage: number;
}

export default function StudentMealAdherence({ studentId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-meal-adherence", studentId],
    queryFn: async () => {
      // Fetch active diet plan to get expected meals
      const { data: dietPlan, error: dietError } = await supabase
        .from("diet_plans")
        .select("meals, created_at")
        .eq("user_id", studentId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dietError) throw dietError;
      if (!dietPlan) return null;

      const meals = dietPlan.meals as any[];
      if (!meals || meals.length === 0) return null;

      const mealNames = meals.map((m: any) => m.name as string);
      const planStartDate = new Date(dietPlan.created_at);

      // Fetch daily habits since plan creation
      const { data: habits, error: habitsError } = await supabase
        .from("daily_habits")
        .select("date, completed_meals")
        .eq("user_id", studentId)
        .gte("date", planStartDate.toISOString().split("T")[0])
        .order("date", { ascending: false });

      if (habitsError) throw habitsError;

      const totalDays = habits?.length || 0;
      if (totalDays === 0) return { mealNames, adherence: [], totalDays: 0 };

      // Count completions per meal
      const completionCount = new Map<string, number>();
      mealNames.forEach((name) => completionCount.set(name, 0));

      for (const habit of habits!) {
        const completed = (habit.completed_meals as string[]) || [];
        for (const mealName of completed) {
          if (completionCount.has(mealName)) {
            completionCount.set(mealName, (completionCount.get(mealName) || 0) + 1);
          }
        }
      }

      const adherence: MealAdherenceData[] = mealNames.map((name) => {
        const completedDays = completionCount.get(name) || 0;
        return {
          mealName: name,
          completedDays,
          totalDays,
          percentage: totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0,
        };
      });

      return { mealNames, adherence, totalDays };
    },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  if (!data || !data.adherence || data.adherence.length === 0) {
    return (
      <div className="text-center text-xs text-muted-foreground py-3 flex flex-col items-center gap-1">
        <UtensilsCrossed size={16} className="opacity-50" />
        {!data ? "Nenhum plano alimentar ativo" : "Sem registros de adesão alimentar"}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        Baseado em {data.totalDays} {data.totalDays === 1 ? "dia" : "dias"} desde a criação do plano
      </p>
      <div className="space-y-2.5">
        {data.adherence.map((meal) => (
          <div key={meal.mealName} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{meal.mealName}</span>
              <span className={cn(
                "text-xs font-bold tabular-nums",
                meal.percentage >= 80 ? "text-emerald-400" :
                meal.percentage >= 50 ? "text-amber-400" :
                "text-red-400"
              )}>
                {meal.percentage}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary/30 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  meal.percentage >= 80 ? "bg-emerald-500" :
                  meal.percentage >= 50 ? "bg-amber-500" :
                  "bg-red-500"
                )}
                style={{ width: `${meal.percentage}%` }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground">
              {meal.completedDays}/{meal.totalDays} dias
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
