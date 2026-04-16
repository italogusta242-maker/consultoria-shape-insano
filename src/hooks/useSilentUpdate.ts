import { useEffect, useRef } from "react";

/**
 * PWA auto-update hook with aggressive activation for standalone PWAs (macOS, etc).
 *
 * Strategy:
 * 1. When new SW is detected (waiting), immediately send SKIP_WAITING.
 * 2. On controllerchange (new SW took control), reload — unless workout is active.
 * 3. Also reload on visibilitychange if a flag was set (legacy behavior).
 * 4. Poll reg.update() every 30 minutes for long-lived PWA windows.
 */
export function useSilentUpdate() {
  const newSwInstalled = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isWorkoutActive = (): boolean => {
      try {
        return !!localStorage.getItem("workout-execution-state");
      } catch {
        return false;
      }
    };

    const activateWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };

    const onControllerChange = () => {
      newSwInstalled.current = true;
      // Reload immediately unless a workout is in progress
      if (!isWorkoutActive()) {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let updateInterval: ReturnType<typeof setInterval> | null = null;

    const setup = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      // If a SW is already waiting, activate it now
      activateWaiting(reg);

      const trackInstalling = (sw: ServiceWorker | null) => {
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            // New SW installed and there's an active controller → activate
            activateWaiting(reg);
          }
        });
      };

      trackInstalling(reg.installing);

      reg.addEventListener("updatefound", () => {
        trackInstalling(reg.installing);
      });

      // Poll for updates every 30 minutes for long-lived PWA windows
      updateInterval = setInterval(() => {
        reg.update().catch(() => {});
      }, 30 * 60 * 1000);
    };

    setup();

    // Fallback: if reload was deferred (workout active), retry on visibility change
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && newSwInstalled.current && !isWorkoutActive()) {
        window.location.reload();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);
}
