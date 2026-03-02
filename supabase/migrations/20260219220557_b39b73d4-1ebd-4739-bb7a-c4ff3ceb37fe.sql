-- Add truce tracking fields to gamification
ALTER TABLE public.gamification
ADD COLUMN IF NOT EXISTS truce_days integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_training_date date DEFAULT NULL;

-- truce_days: 0 = normal, 1 = in truce (1 missed day), 2+ = flame extinguished
-- last_training_date: tracks the last day the student completed a workout