
-- Create update function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Diet plans table
CREATE TABLE public.diet_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  specialist_id UUID,
  title TEXT NOT NULL DEFAULT 'Plano Alimentar',
  meals JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.diet_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own diet plans" ON public.diet_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Especialistas manage diet plans" ON public.diet_plans
  FOR ALL USING (has_role(auth.uid(), 'especialista'::app_role));

CREATE POLICY "Admins read all diet plans" ON public.diet_plans
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_diet_plans_updated_at
  BEFORE UPDATE ON public.diet_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Psychological check-ins table
CREATE TABLE public.psych_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mood INTEGER NOT NULL DEFAULT 3,
  stress INTEGER NOT NULL DEFAULT 3,
  sleep_hours NUMERIC(3,1),
  sleep_quality INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.psych_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own checkins" ON public.psych_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own checkins" ON public.psych_checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Especialistas read checkins" ON public.psych_checkins
  FOR SELECT USING (has_role(auth.uid(), 'especialista'::app_role));

CREATE POLICY "Admins read all checkins" ON public.psych_checkins
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
