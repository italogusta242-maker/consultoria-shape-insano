import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getToday } from "@/lib/dateUtils";
import { optimisticFlameUpdate } from "@/lib/flameOptimistic";
import { checkAndUpdateFlame } from "@/lib/flameMotor";
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
      // DON'T invalidate flame-state here — the optimistic update already set it.
      // Instead, let the DB motor update flame_status, THEN refresh.
      if (user) {
        checkAndUpdateFlame(user.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ["flame-state", user?.id] });
        });
      }
    },
  });

  const setWater = (liters: number) => {
    const clamped = Math.max(0, Math.min(10, liters));
    const oldWater = habits?.water_liters ?? 0;
    const newHabit = {
      ...(habits || { id: "", user_id: user?.id || "", date: targetDate, completed_meals: [] as string[] }),
      water_liters: clamped,
    };

    // Optimistic: update today's habits
    queryClient.setQueryData(["daily-habits", user?.id, targetDate], () => newHabit);

    // Optimistic: also update habits range so useRealPerformance recalculates instantly
    queryClient.setQueryData<DailyHabit[]>(
      ["daily-habits-range", user?.id, 7],
      (old) => {
        if (!old) return [newHabit as DailyHabit];
        const idx = old.findIndex((h) => h.date === targetDate);
        if (idx >= 0) {
          const copy = [...old];
          copy[idx] = { ...copy[idx], water_liters: clamped };
          return copy;
        }
        return [...old, newHabit as DailyHabit];
      }
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

    // Optimistic update: today's habits
    queryClient.setQueryData(
      ["daily-habits", user?.id, targetDate],
      (old: DailyHabit | null) => ({
        ...(old || { id: "", user_id: user?.id || "", date: targetDate, water_liters: 0 }),
        completed_meals: next,
      })
    );

    // Optimistic update: habits range (so useRealPerformance recalculates)
    queryClient.setQueryData<DailyHabit[]>(
      ["daily-habits-range", user?.id, 7],
      (old) => {
        if (!old) return [];
        const idx = old.findIndex((h) => h.date === targetDate);
        if (idx >= 0) {
          const copy = [...old];
          copy[idx] = { ...copy[idx], completed_meals: next };
          return copy;
        }
        return old;
      }
    );

    // Optimistic flame: each meal toggle changes adherence proportionally
    if (user) {
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
