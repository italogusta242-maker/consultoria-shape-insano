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
      // DO NOT invalidate daily-habits or flame-state here!
      // The optimistic updates already set the correct values.
      // Just let the flame motor update the DB in the background.
      if (user) {
        checkAndUpdateFlame(user.id);
        // No invalidateQueries — optimistic state is king
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

    // 1. Optimistic: update today's habits (water bar)
    queryClient.setQueryData(["daily-habits", user?.id, targetDate], () => newHabit);

    // 2. Optimistic: update habits range (performance bar)
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

    // 3. Optimistic flame: water = 10pts proportional to 2.5L goal (chama bar)
    if (user) {
      const oldScore = Math.round(Math.min(oldWater / 2.5, 1) * 10);
      const newScore = Math.round(Math.min(clamped / 2.5, 1) * 10);
      optimisticFlameUpdate(queryClient, user.id, { adherenceDelta: newScore - oldScore });
    }

    // 4. Persist to DB (background, no cache invalidation)
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

    // 1. Optimistic: today's habits (meal checkmarks)
    queryClient.setQueryData(
      ["daily-habits", user?.id, targetDate],
      (old: DailyHabit | null) => ({
        ...(old || { id: "", user_id: user?.id || "", date: targetDate, water_liters: 0 }),
        completed_meals: next,
      })
    );

    // 2. Optimistic: habits range (performance bar)
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

    // 3. Optimistic flame (chama bar)
    if (user) {
      const delta = isRemoving ? -5 : 5;
      optimisticFlameUpdate(queryClient, user.id, {
        adherenceDelta: delta,
        forceActive: !isRemoving && next.length >= 1,
      });

      // Motivational notification (10% chance)
      if (!isRemoving && totalMeals && totalMeals > 0) {
        onMealToggle(user.id, next.length, totalMeals, true);
      }
    }

    // 4. Persist to DB (background, no cache invalidation)
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
