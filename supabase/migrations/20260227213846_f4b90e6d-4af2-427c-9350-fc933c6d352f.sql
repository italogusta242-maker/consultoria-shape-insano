
-- Table for specialists to store their AI training preferences/philosophy
CREATE TABLE public.specialist_ai_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  specialist_id uuid NOT NULL UNIQUE,
  training_philosophy text DEFAULT '',
  preferred_methods text DEFAULT '',
  volume_preferences text DEFAULT '',
  exercise_preferences text DEFAULT '',
  periodization_style text DEFAULT '',
  notes text DEFAULT '',
  example_plans jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.specialist_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specialists manage own AI preferences"
  ON public.specialist_ai_preferences FOR ALL
  USING (auth.uid() = specialist_id)
  WITH CHECK (auth.uid() = specialist_id);

CREATE TRIGGER update_specialist_ai_preferences_updated_at
  BEFORE UPDATE ON public.specialist_ai_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
