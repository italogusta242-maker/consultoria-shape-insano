/**
 * Event-based motivational notifications (client-side triggers)
 * 
 * These fire in-app toasts + sounds for the "Olho do Dono" effect.
 * Notifications are also saved to DB for persistence.
 */

import { supabase } from "@/integrations/supabase/client";
import { SFX } from "@/hooks/useSoundEffects";
import { toast } from "sonner";
import {
  COACH_WATCHING_START,
  NUTRI_WATCHING_DIET,
  NUTRI_WATCHING_HALF,
  POST_WORKOUT_SHARE,
  pickRandom,
  fillTemplate,
  shouldTrigger,
} from "@/lib/motivationalMessages";

/**
 * Called when user starts a workout.
 * 10% chance of "Igor is watching" notification.
 */
export function onWorkoutStart(userId: string) {
  if (!shouldTrigger(0.10)) return;

  const msg = pickRandom(COACH_WATCHING_START);
  
  // Play coach whistle sound
  try { SFX.coachWhistle(); } catch {}
  
  // Show toast
  toast("👀 Igor", { description: msg, duration: 6000 });
  
  // Save to DB (fire and forget)
  supabase.from("notifications").insert({
    user_id: userId,
    title: "👀 Igor",
    body: msg,
    type: "coach_watching",
    metadata: { trigger: "workout_start" },
  }).then();
}

/**
 * Called when user finishes a workout.
 * Always shows the post-workout share prompt.
 */
export function onWorkoutFinish(userId: string, totalVolume: number) {
  const msg = fillTemplate(pickRandom(POST_WORKOUT_SHARE), { volume: Math.round(totalVolume) });
  
  // Play gym plates sound
  try { SFX.gymPlates(); } catch {}
  
  // Show toast
  toast("🏆 Treino Finalizado!", { description: msg, duration: 8000 });
}

/**
 * Called when user toggles a meal.
 * Checks if 50% or 100% of meals are done and triggers nutri notification.
 */
export function onMealToggle(
  userId: string,
  completedCount: number,
  totalMeals: number,
  isAdding: boolean,
) {
  if (!isAdding || totalMeals === 0) return;

  const percentage = completedCount / totalMeals;

  // 100% diet complete → 10% chance
  if (percentage >= 1.0 && shouldTrigger(0.10)) {
    const msg = pickRandom(NUTRI_WATCHING_DIET);
    try { SFX.coachWhistle(); } catch {}
    toast("👀 Nutricionista", { description: msg, duration: 6000 });
    
    supabase.from("notifications").insert({
      user_id: userId,
      title: "👀 Nutricionista",
      body: msg,
      type: "coach_watching",
      metadata: { trigger: "diet_100" },
    }).then();
    return;
  }

  // 50% diet → 10% chance
  if (Math.abs(percentage - 0.5) < 0.01 && shouldTrigger(0.10)) {
    const msg = pickRandom(NUTRI_WATCHING_HALF);
    try { SFX.coachWhistle(); } catch {}
    toast("👀 Nutricionista", { description: msg, duration: 5000 });
  }
}
