
The user confirms the cache/update problem affects ALL users, not just the specialist on macOS PWA. This validates that the root cause is structural — the `index.html` cache strategy combined with how the Service Worker precaches it — not a single-user environment issue.

The plan I had previously is still correct, but now I need to frame it as a global fix and emphasize the one-time manual reset will need to be communicated to all active users (or auto-handled).

Let me also add: since ALL users are affected, we should add a **version detection mechanism** that can force-purge stale caches automatically on next load — without requiring users to manually clear data.

Plan:
1. Remove broken meta cache tags from `index.html`
2. Add cache-busting fetch before `reg.update()` in `useSilentUpdate.ts`
3. Make the "Verificar atualizações" button do hard purge (caches.delete + unregister + reload)
4. Add a **build version check** — embed build timestamp in app, compare against `/version.json` fetched fresh, auto-purge if mismatch. This handles the "ALL users stuck" scenario automatically without needing them to do anything manual.
5. Move the manual "Verificar atualizações" button to a place ALL users see (not just specialist) — like a discrete item in the user dropdown/profile menu, OR just rely on the auto version-check.

Keep it concise.
