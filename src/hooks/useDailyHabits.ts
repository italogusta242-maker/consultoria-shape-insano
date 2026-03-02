import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getToday } from "@/lib/dateUtils";
import { optimisticFlameUpdate } from "@/lib/flameOptimistic";
import { onMealToggle } from "@/lib/coachNotifications";

export interface DailyHabit {
  id: string;
  user_id: string;
  date: string;
  water_liters: number;
  completed_meals: string[];
}

export function useDailyHabits(date?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetDate = date || getToday();

  const { data: habits, isLoading } = useQuery({
    queryKey: ["daily-habits", user?.id, targetDate],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("daily_habits")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", targetDate)
        .maybeSingle();
      if (error) throw error;
      return data as DailyHabit | null;
    },
    enabled: !!user,
  });

  const upsertHabits = useMutation({
    mutationFn: async (updates: { water_liters?: number; completed_meals?: string[] }) => {
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        date: targetDate,
        ...updates,
      };

      const { error } = await supabase
        .from("daily_habits")
        .upsert(payload, { onConflict: "user_id,date" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-habits", user?.id, targetDate] });
      queryClient.invalidateQueries({ queryKey: ["daily-habits-range"] });
      // Invalidate flame state so adherence recalculates immediately
      queryClient.invalidateQueries({ queryKey: ["flame-state", user?.id] });
      // Motor 1: Check if meal completion triggers flame reactivation
      if (user) {
        import("@/lib/flameMotor").then(({ checkAndUpdateFlame }) => {
          checkAndUpdateFlame(user.id).then(() => {
            // Re-invalidate after motor updates flame_status
            queryClient.invalidateQueries({ queryKey: ["flame-state", user?.id] });
          });
        });
      }
    },
  });

  const setWater = (liters: number) => {
    const clamped = Math.max(0, Math.min(10, liters));
    const oldWater = habits?.water_liters ?? 0;
    // Optimistic UI update
    queryClient.setQueryData(
      ["daily-habits", user?.id, targetDate],
      (old: DailyHabit | null) => ({
        ...(old || { id: "", user_id: user?.id || "", date: targetDate, completed_meals: [] }),
        water_liters: clamped,
      })
    );
    // Optimistic flame: water is 10pts proportional to 2.5L goal
    if (user) {
      const oldScore = Math.round(Math.min(oldWater / 2.5, 1) * 10);
      const newScore = Math.round(Math.min(clamped / 2.5, 1) * 10);
      optimisticFlameUpdate(queryClient, user.id, { adherenceDelta: newScore - oldScore });
    }
    upsertHabits.mutate({
      water_liters: clamped,
      completed_meals: habits?.completed_meals || [],
    });
  };

  const toggleMeal = (mealId: string, totalMeals?: number) => {
    const current = habits?.completed_meals || [];
    const isRemoving = current.includes(mealId);
    const next = isRemoving
      ? current.filter((id) => id !== mealId)
      : [...current, mealId];

    // Optimistic update
    queryClient.setQueryData(
      ["daily-habits", user?.id, targetDate],
      (old: DailyHabit | null) => ({
        ...(old || { id: "", user_id: user?.id || "", date: targetDate, water_liters: 0 }),
        completed_meals: next,
      })
    );
    // Optimistic flame: each meal toggle changes adherence proportionally
    if (user) {
      // We don't know totalMeals here precisely, estimate ~5 pts per meal toggle (40pts / ~8 meals)
      const delta = isRemoving ? -5 : 5;
      optimisticFlameUpdate(queryClient, user.id, {
        adherenceDelta: delta,
        forceActive: !isRemoving && next.length >= 1,
      });

      // Motivational notification (10% chance on 50% or 100% diet)
      if (!isRemoving && totalMeals && totalMeals > 0) {
        onMealToggle(user.id, next.length, totalMeals, true);
      }
    }
    upsertHabits.mutate({
      water_liters: habits?.water_liters || 0,
      completed_meals: next,
    });
  };

  return {
    waterIntake: habits?.water_liters ?? 0,
    completedMeals: new Set(habits?.completed_meals ?? []),
    mealsCompletedCount: habits?.completed_meals?.length ?? 0,
    isLoading,
    setWater,
    toggleMeal,
  };
}

/** Hook to fetch habits for a range of dates (for performance chart) */
export function useDailyHabitsRange(days: number) {
  const { user } = useAuth();
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["daily-habits-range", user?.id, days],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("daily_habits")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", startStr)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyHabit[];
    },
    enabled: !!user,
  });
}
