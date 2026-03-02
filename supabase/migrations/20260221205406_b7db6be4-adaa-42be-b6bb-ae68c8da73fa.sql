
CREATE TABLE public.diet_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT NOT NULL DEFAULT 'manutenção', -- 'deficit', 'bulking', 'manutenção', 'recomposição'
  total_calories INTEGER NOT NULL DEFAULT 0,
  total_protein NUMERIC NOT NULL DEFAULT 0,
  total_carbs NUMERIC NOT NULL DEFAULT 0,
  total_fat NUMERIC NOT NULL DEFAULT 0,
  meals JSONB NOT NULL DEFAULT '[]'::jsonb,
  specialist_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.diet_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read diet templates"
  ON public.diet_templates FOR SELECT
  USING (true);

CREATE POLICY "Especialistas manage diet templates"
  ON public.diet_templates FOR ALL
  USING (has_role(auth.uid(), 'especialista'::app_role));

CREATE POLICY "Admins manage diet templates"
  ON public.diet_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_diet_templates_updated_at
  BEFORE UPDATE ON public.diet_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
