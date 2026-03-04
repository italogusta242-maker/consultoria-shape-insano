import { create } from 'zustand';
import type { ExerciseItem } from '@/components/especialista/ExerciseSelector';

interface Group {
  name: string;
  exercises: ExerciseItem[];
}

export interface WorkoutDraft {
  selectedStudent: string;
  title: string;
  totalSessions: number;
  groups: Group[];
  avaliacaoPostural: string;
  pontosMelhoria: string;
  objetivoMesociclo: string;
}

interface WorkoutDraftStore {
  draft: WorkoutDraft | null;
  setDraft: (draft: WorkoutDraft) => void;
  patchDraft: (partial: Partial<WorkoutDraft>) => void;
  clearDraft: () => void;
}

export const useWorkoutDraftStore = create<WorkoutDraftStore>((set, get) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  patchDraft: (partial) => {
    const current = get().draft;
    if (current) {
      set({ draft: { ...current, ...partial } });
    }
  },
  clearDraft: () => set({ draft: null }),
}));
