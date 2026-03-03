import { QueryClient } from "@tanstack/react-query";

interface FlameData {
  state: string;
  streak: number;
  adherence: number;
}

/**
 * Instantly updates the flame UI without waiting for DB round-trip.
 * Call this right when the user performs an action (meal, water, sleep, workout).
 */
export function optimisticFlameUpdate(
  queryClient: QueryClient,
  userId: string,
  delta: { adherenceDelta?: number; forceActive?: boolean; streakIncrement?: boolean }
) {
  queryClient.setQueryData<FlameData>(
    ["flame-state", userId],
    (old) => {
      if (!old) return { state: "ativa", streak: 1, adherence: Math.min(delta.adherenceDelta ?? 0, 100) };
      
      const newAdherence = Math.min(100, Math.max(0, old.adherence + (delta.adherenceDelta ?? 0)));
      
      // Streak increment: when a new day is approved (e.g. workout finished)
      if (delta.streakIncrement) {
        return {
          state: "ativa",
          streak: old.state === "extinta" || old.state === "normal" ? 1 : old.streak + 1,
          adherence: newAdherence,
        };
      }

      if (delta.forceActive && old.state !== "ativa") {
        return {
          state: "ativa",
          streak: old.state === "extinta" ? 1 : old.streak + 1,
          adherence: newAdherence,
        };
      }

      return { ...old, adherence: newAdherence };
    }
  );
}
