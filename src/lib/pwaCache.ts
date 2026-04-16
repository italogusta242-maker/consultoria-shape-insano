/**
 * Aggressively purge all client-side caches and the active Service Worker.
 * Used when a stale build is detected or the user manually requests a hard refresh.
 *
 * Does NOT reload — caller decides when to reload.
 */
export async function hardPurgeCaches(): Promise<void> {
  // 1. Delete every Cache Storage entry (Workbox precache, runtime caches, etc.)
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }

  // 2. Unregister all service workers so the next load fetches a fresh one
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Fetch the deployed build version from /version.json (always bypassing cache).
 * Returns null on failure — caller should treat that as "no info, do nothing".
 */
export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.version === "string" ? json.version : null;
  } catch {
    return null;
  }
}
