import { useEffect, useRef, useCallback } from "react";

/**
 * Auto-saves a draft to localStorage on every change (debounced).
 * On mount, checks if a draft exists and returns it via `onRestore`.
 * Clears the draft on successful save.
 * CRITICAL: Flushes pending saves on unmount to prevent state loss during tab switches.
 */
export function useDraftAutoSave<T>(
  key: string,
  data: T,
  enabled: boolean,
  debounceMs = 2000,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<T>(data);
  const enabledRef = useRef(enabled);
  const keyRef = useRef(key);

  // Keep refs in sync
  latestDataRef.current = data;
  enabledRef.current = enabled;
  keyRef.current = key;

  // Auto-save on data change (debounced)
  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
      } catch {
        // Storage full or unavailable – silently ignore
      }
      timerRef.current = null;
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, data, enabled, debounceMs]);

  // Flush pending save on unmount to survive tab switches
  useEffect(() => {
    return () => {
      if (enabledRef.current) {
        try {
          localStorage.setItem(
            keyRef.current,
            JSON.stringify({ data: latestDataRef.current, savedAt: Date.now() })
          );
        } catch {
          // Storage full or unavailable – silently ignore
        }
      }
    };
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  return { clearDraft };
}

export function loadDraft<T>(key: string): { data: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Discard drafts older than 24h
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
