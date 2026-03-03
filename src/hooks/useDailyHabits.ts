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

      // Background: persist flame state to DB (no cache invalidation)
      await checkAndUpdateFlame(user.id);
    },
    onMutate: async () => {
      // REGRA 1: Cancel in-flight queries to prevent cache overwrites
      await queryClient.cancelQueries({ queryKey: ["flame-state", user?.id] });
      await queryClient.cancelQueries({ queryKey: ["daily-habits", user?.id, targetDate] });
      await queryClient.cancelQueries({ queryKey: ["daily-habits-range", user?.id, 7] });
      await queryClient.cancelQueries({ queryKey: ["daily-habits-range", user?.id, 30] });

      // REGRA 2: Save previous state for rollback
      const previousFlame = queryClient.getQueryData(["flame-state", user?.id]);
      const previousHabits = queryClient.getQueryData(["daily-habits", user?.id, targetDate]);
      const previousRange7 = queryClient.getQueryData(["daily-habits-range", user?.id, 7]);
      const previousRange30 = queryClient.getQueryData(["daily-habits-range", user?.id, 30]);

      return { previousFlame, previousHabits, previousRange7, previousRange30 };
    },
    onError: (_err, _vars, context) => {
      // REGRA 3: Rollback on failure
      if (context?.previousFlame) {
        queryClient.setQueryData(["flame-state", user?.id], context.previousFlame);
      }
      if (context?.previousHabits) {
        queryClient.setQueryData(["daily-habits", user?.id, targetDate], context.previousHabits);
      }
      if (context?.previousRange7) {
        queryClient.setQueryData(["daily-habits-range", user?.id, 7], context.previousRange7);
      }
      if (context?.previousRange30) {
        queryClient.setQueryData(["daily-habits-range", user?.id, 30], context.previousRange30);
      }
    },
    // REGRA 4: NO invalidateQueries here — optimistic state is king
    onSuccess: () => {},
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

    // 2. Optimistic: update ALL habits range caches (performance uses 30, chart uses 7)
    for (const rangeDays of [7, 30]) {
      queryClient.setQueryData<DailyHabit[]>(
        ["daily-habits-range", user?.id, rangeDays],
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
    }

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

    // 2. Optimistic: update ALL habits range caches (performance uses 30, chart uses 7)
    for (const rangeDays of [7, 30]) {
      queryClient.setQueryData<DailyHabit[]>(
        ["daily-habits-range", user?.id, rangeDays],
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
    }

    // 3. Optimistic flame (chama bar) — proportional to total meals (40pts max)
    if (user) {
      const mealCount = totalMeals && totalMeals > 0 ? totalMeals : 6;
      const perMealDelta = Math.round(40 / mealCount);
      const delta = isRemoving ? -perMealDelta : perMealDelta;
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
