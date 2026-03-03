import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toLocalDate } from "@/lib/dateUtils";

export type FlameState = "normal" | "ativa" | "tregua" | "extinta";

export interface FlameResult {
  state: FlameState;
  streak: number;
  /** Adherence percentage based on 4 pillars (0-100) */
  adherence: number;
}

/**
 * Chama de Honra — Optimistic-first architecture.
 *
 * This hook is READ-ONLY from the DB perspective. It fetches the initial state
 * once and then relies entirely on optimistic updates via `optimisticFlameUpdate`.
 *
 * NO Realtime listener — it was causing race conditions that overwrote optimistic state.
 * NO adherence recalculation on every fetch — adherence is managed optimistically.
 *
 * The DB is the source of truth for state/streak (via flameMotor.checkAndUpdateFlame),
 * but the UI always shows the optimistic value first.
 *
 * staleTime = 5 minutes: prevents refetches on window focus / remount from
 * destroying the optimistic cache.
 */
export function useFlameState(): FlameResult & { isLoading: boolean } {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["flame-state", user?.id],
    queryFn: async (): Promise<FlameResult> => {
      if (!user) return { state: "normal", streak: 0, adherence: 0 };

      // Read flame_status from DB
      const { data: flameStatus } = await supabase
        .from("flame_status")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // Calculate adherence from DB (only on initial load / manual refresh)
      const adherence = await calculateAdherence(user.id);

      if (flameStatus) {
        return {
          state: flameStatus.state as FlameState,
          streak: flameStatus.streak,
          adherence,
        };
      }

      // No record yet — bootstrap
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
    staleTime: 5 * 60 * 1000, // 5 minutes — optimistic updates handle the UI
    gcTime: 10 * 60 * 1000,
  });

  // NO Realtime listener — optimistic updates are the source of truth for UI

  return {
    state: data?.state ?? "normal",
    streak: data?.streak ?? 0,
    adherence: data?.adherence ?? 0,
    isLoading,
  };
}

/**
 * Check if a day is "approved" for the flame system.
 */
async function isDayApproved(userId: string, dateStr: string): Promise<boolean> {
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("finished_at", `${dateStr}T00:00:00`)
    .lt("finished_at", `${dateStr}T23:59:59.999`)
    .limit(1);

  if (workouts && workouts.length > 0) return true;

  const { data: habits } = await supabase
    .from("daily_habits")
    .select("completed_meals")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .maybeSingle();

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
        const completedCount = habits.completed_meals.length;
        if (completedCount / totalMeals >= 0.5) return true;
      }
    }
  }

  return false;
}

/**
 * Calculate today's adherence percentage based on 4 pillars:
 * - Treino: 40 pts | Dieta: 40 pts | Água: 10 pts | Sono: 10 pts
 */
async function calculateAdherence(userId: string): Promise<number> {
  const todayStr = toLocalDate(new Date());
  let score = 0;

  const [workoutsRes, habitsRes, checkinRes] = await Promise.all([
    supabase
      .from("workouts")
      .select("id")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .gte("finished_at", `${todayStr}T00:00:00`)
      .lt("finished_at", `${todayStr}T23:59:59.999`)
      .limit(1),
    supabase
      .from("daily_habits")
      .select("completed_meals, water_liters")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .maybeSingle(),
    supabase
      .from("psych_checkins")
      .select("sleep_hours")
      .eq("user_id", userId)
      .gte("created_at", `${todayStr}T00:00:00`)
      .lt("created_at", `${todayStr}T23:59:59.999`)
      .limit(1)
      .maybeSingle(),
  ]);

  // Treino (40 pts)
  if (workoutsRes.data && workoutsRes.data.length > 0) score += 40;

  // Dieta (40 pts)
  const habits = habitsRes.data;
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

  // Água (10 pts)
  if (habits?.water_liters) {
    score += Math.round(Math.min(Number(habits.water_liters) / 2.5, 1) * 10);
  }

  // Sono (10 pts)
  if (checkinRes.data?.sleep_hours && Number(checkinRes.data.sleep_hours) > 0) {
    score += 10;
  }

  return score;
}
