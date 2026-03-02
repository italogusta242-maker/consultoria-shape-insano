import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toLocalDate } from "@/lib/dateUtils";
import { useEffect } from "react";

export type FlameState = "normal" | "ativa" | "tregua" | "extinta";

interface FlameResult {
  state: FlameState;
  streak: number;
  /** Adherence percentage based on training days vs expected */
  adherence: number;
}

/**
 * Chama de Honra — Reads persistent state from `flame_status` table.
 * Falls back to calculating state if no record exists yet.
 *
 * Motor 1 (Immediate): Called when user finishes workout or completes diet.
 * Motor 2 (Midnight Judge): Cron job at 03:00 UTC (00:00 BRT) demotes inactive users.
 *
 * Day approval rule (50/50):
 * - Training day: approved if user trained OR completed ≥50% of diet meals
 * - Rest day: approved if user completed ≥50% of diet meals
 */
export function useFlameState(): FlameResult & { isLoading: boolean } {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["flame-state", user?.id],
    queryFn: async (): Promise<FlameResult> => {
      if (!user) return { state: "normal", streak: 0, adherence: 0 };

      // Try to read from flame_status table first
      const { data: flameStatus } = await supabase
        .from("flame_status")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // Calculate adherence (last 7 days)
      const adherence = await calculateAdherence(user.id);

      if (flameStatus) {
        // Check if user did something TODAY that should reactivate flame (Motor 1)
        const todayApproved = await isDayApproved(user.id, toLocalDate(new Date()));
        
        if (todayApproved && (flameStatus.state === "tregua" || flameStatus.state === "extinta" || flameStatus.state === "normal")) {
          // Immediately reactivate flame
          const newStreak = flameStatus.state === "extinta" ? 1 : flameStatus.streak + 1;
          const todayStr = toLocalDate(new Date());
          
          await supabase
            .from("flame_status")
            .update({ 
              state: "ativa", 
              streak: newStreak, 
              last_approved_date: todayStr,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", user.id);
          
          return { state: "ativa", streak: newStreak, adherence };
        }

        // If ativa but today already approved, increment streak if not already done today
        if (todayApproved && flameStatus.state === "ativa" && flameStatus.last_approved_date !== toLocalDate(new Date())) {
          const newStreak = flameStatus.streak + 1;
          const todayStr = toLocalDate(new Date());
          
          await supabase
            .from("flame_status")
            .update({ 
              streak: newStreak, 
              last_approved_date: todayStr,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", user.id);
          
          return { state: "ativa", streak: newStreak, adherence };
        }

        return {
          state: flameStatus.state as FlameState,
          streak: flameStatus.streak,
          adherence,
        };
      }

      // No flame_status record yet — bootstrap it
      const todayApproved = await isDayApproved(user.id, toLocalDate(new Date()));
      const initialState: FlameState = todayApproved ? "ativa" : "normal";
      const initialStreak = todayApproved ? 1 : 0;

      await supabase
        .from("flame_status")
        .upsert({
          user_id: user.id,
          state: initialState,
          streak: initialStreak,
          last_approved_date: todayApproved ? toLocalDate(new Date()) : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      return { state: initialState, streak: initialStreak, adherence };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Subscribe to realtime changes on flame_status
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`flame-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "flame_status",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["flame-state", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    state: data?.state ?? "normal",
    streak: data?.streak ?? 0,
    adherence: data?.adherence ?? 0,
    isLoading,
  };
}

/**
 * Check if a day is "approved" for the flame system.
 * A day is approved if user did at least one of:
 * 1. Completed a workout (on training days)
 * 2. Completed ≥50% of diet plan meals
 * On rest days, only diet counts.
 */
async function isDayApproved(userId: string, dateStr: string): Promise<boolean> {
  // Check if user trained on this date
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("finished_at", `${dateStr}T00:00:00`)
    .lt("finished_at", `${dateStr}T23:59:59.999`)
    .limit(1);

  if (workouts && workouts.length > 0) return true;

  // Check diet compliance (50% of meals)
  const { data: habits } = await supabase
    .from("daily_habits")
    .select("completed_meals")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .maybeSingle();

  if (habits?.completed_meals) {
    // Get total meals from active diet plan
    const { data: dietPlan } = await supabase
      .from("diet_plans")
      .select("meals")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dietPlan?.meals) {
      const totalMeals = Array.isArray(dietPlan.meals) ? (dietPlan.meals as any[]).length : 0;
      if (totalMeals > 0) {
        const completedCount = habits.completed_meals.length;
        const percentage = completedCount / totalMeals;
        if (percentage >= 0.5) return true;
      }
    }
  }

  return false;
}

/**
 * Calculate today's adherence percentage based on 4 pillars:
 * - Treino: 40 pts (completed a workout today)
 * - Dieta: 40 pts (proportional to completed meals / total meals)
 * - Água: 10 pts (proportional to water intake / 2.5L goal)
 * - Sono: 10 pts (logged sleep today)
 */
async function calculateAdherence(userId: string): Promise<number> {
  const todayStr = toLocalDate(new Date());
  let score = 0;

  // Treino (40 pts) — check if user trained today
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("finished_at", `${todayStr}T00:00:00`)
    .lt("finished_at", `${todayStr}T23:59:59.999`)
    .limit(1);

  if (workouts && workouts.length > 0) score += 40;

  // Get daily habits for today
  const { data: habits } = await supabase
    .from("daily_habits")
    .select("completed_meals, water_liters")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .maybeSingle();

  // Dieta (40 pts) — proportional to meals completed
  if (habits?.completed_meals) {
    const { data: dietPlan } = await supabase
      .from("diet_plans")
      .select("meals")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dietPlan?.meals) {
      const totalMeals = Array.isArray(dietPlan.meals) ? (dietPlan.meals as any[]).length : 0;
      if (totalMeals > 0) {
        const ratio = Math.min(habits.completed_meals.length / totalMeals, 1);
        score += Math.round(ratio * 40);
      }
    }
  }

  // Água (10 pts) — proportional to water intake (goal: 2.5L)
  if (habits?.water_liters) {
    const waterRatio = Math.min(Number(habits.water_liters) / 2.5, 1);
    score += Math.round(waterRatio * 10);
  }

  // Sono (10 pts) — check if user logged sleep today
  const { data: checkin } = await supabase
    .from("psych_checkins")
    .select("sleep_hours")
    .eq("user_id", userId)
    .gte("created_at", `${todayStr}T00:00:00`)
    .lt("created_at", `${todayStr}T23:59:59.999`)
    .limit(1)
    .maybeSingle();

  if (checkin?.sleep_hours && Number(checkin.sleep_hours) > 0) score += 10;

  return score;
}
