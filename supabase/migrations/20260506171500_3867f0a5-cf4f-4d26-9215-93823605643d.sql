CREATE TABLE public.specialist_favorite_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (specialist_id, exercise_id)
);

CREATE INDEX idx_spec_fav_ex_specialist ON public.specialist_favorite_exercises (specialist_id);

ALTER TABLE public.specialist_favorite_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specialists manage own favorite exercises"
ON public.specialist_favorite_exercises
FOR ALL
TO authenticated
USING (auth.uid() = specialist_id)
WITH CHECK (auth.uid() = specialist_id);