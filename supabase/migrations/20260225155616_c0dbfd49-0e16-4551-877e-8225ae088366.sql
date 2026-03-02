
-- Add new columns to exercise_library for richer exercise data
ALTER TABLE public.exercise_library
  ADD COLUMN IF NOT EXISTS gif_url text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS equipment text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS secondary_muscles text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS external_id text;

-- Add unique constraint on external_id for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_library_external_id ON public.exercise_library(external_id) WHERE external_id IS NOT NULL;
