
-- Table to store per-student volume limits set by the trainer
CREATE TABLE IF NOT EXISTS public.volume_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  specialist_id UUID NOT NULL,
  muscle_group TEXT NOT NULL,
  min_sets INTEGER NOT NULL DEFAULT 8,
  max_sets INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one record per student+specialist+muscle_group
CREATE UNIQUE INDEX IF NOT EXISTS volume_limits_student_specialist_group_idx
  ON public.volume_limits (student_id, specialist_id, muscle_group);

ALTER TABLE public.volume_limits ENABLE ROW LEVEL SECURITY;

-- Specialists can manage volume limits for their students
CREATE POLICY "Specialists manage volume limits"
  ON public.volume_limits FOR ALL
  USING (has_role(auth.uid(), 'especialista'::app_role));

-- Students can read their own volume limits
CREATE POLICY "Students read own volume limits"
  ON public.volume_limits FOR SELECT
  USING (auth.uid() = student_id);

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_volume_limits_updated_at
  BEFORE UPDATE ON public.volume_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
