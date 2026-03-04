import { create } from 'zustand';
import type { ExerciseItem } from '@/components/especialista/ExerciseSelector';

interface Group {
  name: string;
  exercises: ExerciseItem[];
}

export interface WorkoutDraft {
  title: string;
  totalSessions: number;
  groups: Group[];
  avaliacaoPostural: string;
  pontosMelhoria: string;
  objetivoMesociclo: string;
}

interface WorkoutDraftStore {
  drafts: Record<string, WorkoutDraft>;
  getDraft: (studentId: string) => WorkoutDraft | null;
  setDraft: (studentId: string, draft: WorkoutDraft) => void;
  patchDraft: (studentId: string, partial: Partial<WorkoutDraft>) => void;
  clearDraft: (studentId: string) => void;
}

export const useWorkoutDraftStore = create<WorkoutDraftStore>((set, get) => ({
  drafts: {},
  getDraft: (studentId) => get().drafts[studentId] ?? null,
  setDraft: (studentId, draft) =>
    set((state) => ({ drafts: { ...state.drafts, [studentId]: draft } })),
  patchDraft: (studentId, partial) => {
    const current = get().drafts[studentId];
    if (current) {
      set((state) => ({
        drafts: { ...state.drafts, [studentId]: { ...current, ...partial } },
      }));
    }
  },
  clearDraft: (studentId) =>
    set((state) => {
      const newDrafts = { ...state.drafts };
      delete newDrafts[studentId];
      return { drafts: newDrafts };
    }),
}));
