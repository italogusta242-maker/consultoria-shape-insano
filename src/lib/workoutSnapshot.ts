/**
 * Local-first persistence for an in-progress workout.
 *
 * Why this exists:
 * Mobile browsers (and the PWA) routinely kill background tabs when the user
 * jumps to WhatsApp/Spotify or the network drops. Without immediate, synchronous
 * persistence, the in-memory state of the workout (sets done, weights, reps)
 * is lost on resume. This helper writes the snapshot to localStorage on every
 * meaningful action so the workout can be restored exactly where it left off.
 *
 * Public API:
 *  - saveWorkoutExecutionSnapshot(snapshot)
 *  - loadWorkoutExecutionSnapshot()
 *  - clearWorkoutExecutionSnapshot()
 *  - saveWorkoutInProgress(groupIndex, payload)
 *  - clearWorkoutInProgress(groupIndex)
 *  - hasWorkoutExecutionSnapshot()
 */

import { getToday } from "@/lib/dateUtils";

const EXECUTION_KEY = "workout-execution-state";
const inProgressKey = (groupIndex: number) => `workout-in-progress-${groupIndex}`;

export interface WorkoutExecutionSnapshot {
  date: string;
  view: "detail" | "execution";
  userId: string | null;
  selectedGroup: number;
  groupName: string;
  startedAt: string;
  exercises: unknown[];
  expandedExercise: number | null;
}

export interface WorkoutInProgressSnapshot {
  date: string;
  userId: string | null;
  groupName: string;
  exercises: unknown[];
}

/**
 * Keys we are allowed to evict from localStorage when we run out of quota
 * trying to persist the live workout. NEVER evict the snapshot itself or
 * other in-progress group drafts — those are the data we are protecting.
 */
const EVICTABLE_KEY_PREFIXES = [
  "diet-draft-",            // diet plan drafts (safe to lose, autosaved on backend)
  "workout-draft-",         // specialist-side workout draft
  "sb-",                    // supabase auth/cache leftovers (regenerated)
  "react-query-",           // any react-query persistence leftovers
  "lovable-",               // misc lovable cache
];

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22 ||
    err.code === 1014
  );
}

/** Last-resort eviction so the workout snapshot can fit. Never touches workout keys. */
function evictNonEssentialKeys(): number {
  let removed = 0;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === EXECUTION_KEY) continue;
      if (key.startsWith("workout-in-progress-")) continue;
      if (EVICTABLE_KEY_PREFIXES.some((p) => key.startsWith(p))) {
        toRemove.push(key);
      }
    }
    for (const k of toRemove) {
      try { localStorage.removeItem(k); removed++; } catch {}
    }
  } catch {}
  return removed;
}

/** Synchronously persists the active execution snapshot. Safe to call on every event. */
export function saveWorkoutExecutionSnapshot(
  snapshot: Omit<WorkoutExecutionSnapshot, "date"> & { date?: string }
): void {
  const payload: WorkoutExecutionSnapshot = {
    date: snapshot.date ?? getToday(),
    view: snapshot.view,
    userId: snapshot.userId,
    selectedGroup: snapshot.selectedGroup,
    groupName: snapshot.groupName,
    startedAt: snapshot.startedAt,
    exercises: snapshot.exercises,
    expandedExercise: snapshot.expandedExercise,
  };
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(EXECUTION_KEY, serialized);
  } catch (error) {
    if (isQuotaError(error)) {
      const removed = evictNonEssentialKeys();
      console.error(
        `[workoutSnapshot] QuotaExceededError ao salvar treino. Evicted ${removed} chave(s) não essenciais. Tentando novamente...`,
        error
      );
      try {
        localStorage.setItem(EXECUTION_KEY, serialized);
        return;
      } catch (retryError) {
        console.error(
          "[workoutSnapshot] Falha ao salvar snapshot mesmo após eviction. Sessão de treino em risco.",
          retryError
        );
      }
    } else {
      console.error("[workoutSnapshot] Erro inesperado ao salvar snapshot:", error);
    }
  }
}

/**
 * Hard expiration safety net. The previous "immortal" snapshot caused users
 * to get stuck on /treinos with a perpetual auto-finalize loop after the app
 * was left idle for hours/days. Anything older than this is treated as
 * abandoned and silently discarded on load.
 */
const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

function isSnapshotExpired(snap: WorkoutExecutionSnapshot | null): boolean {
  if (!snap) return false;
  try {
    if (snap.startedAt) {
      const age = Date.now() - new Date(snap.startedAt).getTime();
      if (Number.isFinite(age) && age > SNAPSHOT_MAX_AGE_MS) return true;
    }
    // Also expire if the snapshot was saved on a previous calendar day.
    if (snap.date && snap.date !== getToday()) return true;
  } catch {}
  return false;
}

/**
 * Loads the active workout snapshot. Snapshots older than 6h (or from a
 * previous day) are auto-cleared to prevent stale "treino finalizado" loops.
 */
export function loadWorkoutExecutionSnapshot(): WorkoutExecutionSnapshot | null {
  try {
    const raw = localStorage.getItem(EXECUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkoutExecutionSnapshot;
    if (!parsed) {
      localStorage.removeItem(EXECUTION_KEY);
      return null;
    }
    if (isSnapshotExpired(parsed)) {
      localStorage.removeItem(EXECUTION_KEY);
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(EXECUTION_KEY); } catch {}
    return null;
  }
}

export function clearWorkoutExecutionSnapshot(): void {
  try { localStorage.removeItem(EXECUTION_KEY); } catch {}
}

export function hasWorkoutExecutionSnapshot(): boolean {
  try {
    const raw = localStorage.getItem(EXECUTION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as WorkoutExecutionSnapshot;
    if (isSnapshotExpired(parsed)) {
      localStorage.removeItem(EXECUTION_KEY);
      return false;
    }
    return true;
  } catch {
    try { localStorage.removeItem(EXECUTION_KEY); } catch {}
    return false;
  }
}


/** Per-group "draft" snapshot used for re-entering a workout the same day. */
export function saveWorkoutInProgress(
  groupIndex: number,
  payload: Omit<WorkoutInProgressSnapshot, "date"> & { date?: string }
): void {
  try {
    const data: WorkoutInProgressSnapshot = {
      date: payload.date ?? getToday(),
      userId: payload.userId,
      groupName: payload.groupName,
      exercises: payload.exercises,
    };
    localStorage.setItem(inProgressKey(groupIndex), JSON.stringify(data));
  } catch {}
}

export function clearWorkoutInProgress(groupIndex: number): void {
  try { localStorage.removeItem(inProgressKey(groupIndex)); } catch {}
}
