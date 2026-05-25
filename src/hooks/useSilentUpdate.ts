import { useEffect, useRef } from "react";
import { fetchDeployedVersion, hardPurgeCaches } from "@/lib/pwaCache";
import { hasWorkoutExecutionSnapshot } from "@/lib/workoutSnapshot";

/**
 * PWA auto-update hook.
 *
 * Strategy:
 * 1. On mount, fetch /version.json fresh and compare with embedded __BUILD_VERSION__.
 *    If they differ → hard purge caches + unregister SW + reload. This recovers
 *    users stuck on stale precached HTML without manual intervention.
 * 2. If no mismatch, follow the normal SW update flow:
 *    - When a new SW is detected (waiting), send SKIP_WAITING.
 *    - On controllerchange, reload — unless a workout is active.
 *    - Poll reg.update() every 30 minutes (cache-busting the HTML first).
 *
 * IMPORTANT: We never auto-reload while a workout is in progress; pulling
 * the rug under the user mid-execution would wipe the in-memory state.
 * The local snapshot would survive, but reloading is still disruptive.
 */
const MONTHLY_SUBMITTING_FLAG = "monthly-assessment-submitting";

function isCriticalFormSubmitting(): boolean {
  try {
    return sessionStorage.getItem(MONTHLY_SUBMITTING_FLAG) === "1";
  } catch {
    return false;
  }
}

export function useSilentUpdate() {
  const newSwInstalled = useRef(false);
  const versionCheckRan = useRef(false);

  useEffect(() => {
    const isWorkoutActive = (): boolean => hasWorkoutExecutionSnapshot();

    // Request persistent storage so iOS/Safari & aggressive browsers don't
    // evict our localStorage (workout snapshot) under memory pressure.
    // Best-effort; on iOS it's typically only granted for installed PWAs.
    (async () => {
      try {
        if (navigator.storage && typeof navigator.storage.persist === "function") {
          const already = await navigator.storage.persisted?.();
          if (!already) {
            const granted = await navigator.storage.persist();
            console.info(`[storage] persistent storage: ${granted ? "granted" : "denied"}`);
          }
        }
      } catch {
        /* ignore */
      }
    })();


    // -------- Version check (handles "all users stuck on old build") --------
    const runVersionCheck = async () => {
      if (versionCheckRan.current) return;
      versionCheckRan.current = true;

      const embedded = typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : null;
      if (!embedded) return;

      const deployed = await fetchDeployedVersion();
      if (!deployed || deployed === embedded) return;

      // Stale build detected. Don't yank the rug if the user is mid-workout.
      if (isWorkoutActive() || isCriticalFormSubmitting()) return;

      await hardPurgeCaches();
      // Cache-bust the HTML one more time so the reload definitely pulls fresh
      try {
        await fetch(window.location.href, { cache: "no-store" });
      } catch {
        /* ignore */
      }
      window.location.reload();
    };

    // Run version check immediately and again on tab focus
    runVersionCheck();
    const onFocus = () => {
      if (isWorkoutActive() || isCriticalFormSubmitting()) return;
      versionCheckRan.current = false;
      runVersionCheck();
    };
    window.addEventListener("focus", onFocus);

    // -------- Standard SW update flow --------
    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("focus", onFocus);
      };
    }

    const activateWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };

    const onControllerChange = () => {
      newSwInstalled.current = true;
      if (!isWorkoutActive()) {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let updateInterval: ReturnType<typeof setInterval> | null = null;

    const setup = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      activateWaiting(reg);

      const trackInstalling = (sw: ServiceWorker | null) => {
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            activateWaiting(reg);
          }
        });
      };

      trackInstalling(reg.installing);

      reg.addEventListener("updatefound", () => {
        trackInstalling(reg.installing);
      });

      // Poll for updates every 30 minutes — cache-bust HTML first so the
      // browser actually sees new asset hashes
      updateInterval = setInterval(async () => {
        try {
          await fetch(window.location.href, { cache: "no-store" });
        } catch {
          /* ignore */
        }
        reg.update().catch(() => {});
      }, 30 * 60 * 1000);
    };

    setup();

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && newSwInstalled.current && !isWorkoutActive()) {
        window.location.reload();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);
}
