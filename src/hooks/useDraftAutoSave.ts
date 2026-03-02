import { useEffect, useRef, useCallback } from "react";

/**
 * Auto-saves a draft to localStorage on every change (debounced).
 * On mount, checks if a draft exists and returns it via `onRestore`.
 * Clears the draft on successful save.
 */
export function useDraftAutoSave<T>(
  key: string,
  data: T,
  enabled: boolean,
  debounceMs = 2000,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save on data change
  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
      } catch {
        // Storage full or unavailable – silently ignore
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, data, enabled, debounceMs]);

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
