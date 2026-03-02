
-- Training plan versions (snapshots)
CREATE TABLE public.training_plan_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_sessions INTEGER NOT NULL DEFAULT 50,
  avaliacao_postural TEXT,
  objetivo_mesociclo TEXT,
  pontos_melhoria TEXT,
  valid_until DATE,
  specialist_id UUID,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  version_number INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.training_plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all training_plan_versions"
  ON public.training_plan_versions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Especialistas manage training_plan_versions"
  ON public.training_plan_versions FOR ALL
  USING (has_role(auth.uid(), 'especialista'::app_role));

CREATE POLICY "Personal manage training_plan_versions"
  ON public.training_plan_versions FOR ALL
  USING (has_role(auth.uid(), 'personal'::app_role))
  WITH CHECK (has_role(auth.uid(), 'personal'::app_role));

CREATE INDEX idx_training_plan_versions_plan_id ON public.training_plan_versions(plan_id);

-- Diet plan versions (snapshots)
CREATE TABLE public.diet_plan_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meals JSONB NOT NULL DEFAULT '[]'::jsonb,
  goal TEXT NOT NULL DEFAULT 'manutenção',
  goal_description TEXT,
  valid_until DATE,
  specialist_id UUID,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  version_number INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.diet_plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all diet_plan_versions"
  ON public.diet_plan_versions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Especialistas manage diet_plan_versions"
  ON public.diet_plan_versions FOR ALL
  USING (has_role(auth.uid(), 'especialista'::app_role));

CREATE POLICY "Nutricionista manage diet_plan_versions"
  ON public.diet_plan_versions FOR ALL
  USING (has_role(auth.uid(), 'nutricionista'::app_role))
  WITH CHECK (has_role(auth.uid(), 'nutricionista'::app_role));

CREATE INDEX idx_diet_plan_versions_plan_id ON public.diet_plan_versions(plan_id);

-- Trigger: auto-snapshot training plan before update
CREATE OR REPLACE FUNCTION public.snapshot_training_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Only snapshot if groups actually changed
  IF OLD.groups IS DISTINCT FROM NEW.groups OR OLD.title IS DISTINCT FROM NEW.title THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM public.training_plan_versions WHERE plan_id = OLD.id;

    INSERT INTO public.training_plan_versions (plan_id, title, groups, total_sessions, avaliacao_postural, objetivo_mesociclo, pontos_melhoria, valid_until, specialist_id, version_number)
    VALUES (OLD.id, OLD.title, OLD.groups, OLD.total_sessions, OLD.avaliacao_postural, OLD.objetivo_mesociclo, OLD.pontos_melhoria, OLD.valid_until, OLD.specialist_id, next_version);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_training_plan
BEFORE UPDATE ON public.training_plans
FOR EACH ROW EXECUTE FUNCTION public.snapshot_training_plan();

-- Trigger: auto-snapshot diet plan before update
CREATE OR REPLACE FUNCTION public.snapshot_diet_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  next_version INTEGER;
BEGIN
  IF OLD.meals IS DISTINCT FROM NEW.meals OR OLD.title IS DISTINCT FROM NEW.title THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM public.diet_plan_versions WHERE plan_id = OLD.id;

    INSERT INTO public.diet_plan_versions (plan_id, title, meals, goal, goal_description, valid_until, specialist_id, version_number)
    VALUES (OLD.id, OLD.title, OLD.meals, OLD.goal, OLD.goal_description, OLD.valid_until, OLD.specialist_id, next_version);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_diet_plan
BEFORE UPDATE ON public.diet_plans
FOR EACH ROW EXECUTE FUNCTION public.snapshot_diet_plan();
