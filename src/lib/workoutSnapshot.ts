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

/** Synchronously persists the active execution snapshot. Safe to call on every event. */
export function saveWorkoutExecutionSnapshot(
  snapshot: Omit<WorkoutExecutionSnapshot, "date"> & { date?: string }
): void {
  try {
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
    localStorage.setItem(EXECUTION_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — best-effort, ignore.
  }
}

export function loadWorkoutExecutionSnapshot(): WorkoutExecutionSnapshot | null {
  try {
    const raw = localStorage.getItem(EXECUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkoutExecutionSnapshot;
    if (!parsed || parsed.date !== getToday()) {
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
  try { return !!localStorage.getItem(EXECUTION_KEY); } catch { return false; }
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
