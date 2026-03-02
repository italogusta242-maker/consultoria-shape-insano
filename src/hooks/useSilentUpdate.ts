import { useEffect, useRef } from "react";

/**
 * Silent PWA auto-update hook.
 * When a new SW is installed in background AND the user leaves the tab/app,
 * the page reloads silently so they return to the latest version.
 */
export function useSilentUpdate() {
  const newSwInstalled = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Listen for new SW becoming installed
    const onControllerChange = () => {
      newSwInstalled.current = true;
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Also detect when a waiting SW activates
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

    // When user hides the app (minimise, switch tab, lock screen), reload silently
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && newSwInstalled.current) {
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
