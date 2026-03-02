/**
 * @purpose Centralized type definitions for the training domain.
 * @dependencies Used by TrainingPlanEditor, Treinos page, TemplateManager, workouts.
 */

/** An exercise within a training session */
export interface TrainingExercise {
  name: string;
  sets: number;
  reps: string;
  rest?: string;
  notes?: string;
  video_id?: string | null;
  muscle_group?: string;
}

/** A training group (e.g., "Treino A - Peito e Tríceps") */
export interface TrainingGroup {
  name: string;
  exercises: TrainingExercise[];
}

/** Volume limits per muscle group for a student */
export interface VolumeLimits {
  id: string;
  muscle_group: string;
  min_sets: number;
  max_sets: number;
  student_id: string;
  specialist_id: string;
}
