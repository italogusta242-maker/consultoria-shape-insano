import { useEffect, useRef } from "react";

/**
 * Silent PWA auto-update hook.
 * When a new SW is installed in background AND the user leaves the tab/app,
 * the page reloads silently so they return to the latest version.
 *
 * IMPORTANT: If a workout is in progress (workout-execution-state in localStorage),
 * the reload is deferred until the workout finishes to prevent data loss.
 */
export function useSilentUpdate() {
  const newSwInstalled = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => {
      newSwInstalled.current = true;
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const detectWaiting = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      const check = (sw: ServiceWorker | null) => {
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated") {
            newSwInstalled.current = true;
          }
        });
      };

      check(reg.installing);
      check(reg.waiting);

      reg.addEventListener("updatefound", () => {
        check(reg.installing);
      });
    };

    detectWaiting();

    const isWorkoutActive = (): boolean => {
      try {
        return !!localStorage.getItem("workout-execution-state");
      } catch {
        return false;
      }
    };

    // When user hides the app (minimise, switch tab, lock screen), reload silently
    // BUT NOT if a workout is in progress — that would lose their session
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && newSwInstalled.current) {
        if (isWorkoutActive()) {
          // Defer reload — will happen next time visibility changes after workout ends
          return;
        }
        window.location.reload();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
