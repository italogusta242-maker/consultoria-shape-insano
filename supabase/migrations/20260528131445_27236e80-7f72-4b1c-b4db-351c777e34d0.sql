
-- 1) Snapshot mais completo de training_plans
CREATE OR REPLACE FUNCTION public.snapshot_training_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_version INTEGER;
BEGIN
  IF OLD.groups IS DISTINCT FROM NEW.groups
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.avaliacao_postural IS DISTINCT FROM NEW.avaliacao_postural
     OR OLD.pontos_melhoria IS DISTINCT FROM NEW.pontos_melhoria
     OR OLD.objetivo_mesociclo IS DISTINCT FROM NEW.objetivo_mesociclo
     OR OLD.progression_guide IS DISTINCT FROM NEW.progression_guide
     OR OLD.valid_until IS DISTINCT FROM NEW.valid_until
     OR OLD.total_sessions IS DISTINCT FROM NEW.total_sessions
  THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM public.training_plan_versions WHERE plan_id = OLD.id;

    INSERT INTO public.training_plan_versions
      (plan_id, title, groups, total_sessions, avaliacao_postural, objetivo_mesociclo, pontos_melhoria, progression_guide, valid_until, specialist_id, version_number)
    VALUES
      (OLD.id, OLD.title, OLD.groups, OLD.total_sessions, OLD.avaliacao_postural, OLD.objetivo_mesociclo, OLD.pontos_melhoria, OLD.progression_guide, OLD.valid_until, OLD.specialist_id, next_version);
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Snapshot mais completo de diet_plans
CREATE OR REPLACE FUNCTION public.snapshot_diet_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_version INTEGER;
BEGIN
  IF OLD.meals IS DISTINCT FROM NEW.meals
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.goal IS DISTINCT FROM NEW.goal
     OR OLD.goal_description IS DISTINCT FROM NEW.goal_description
     OR OLD.valid_until IS DISTINCT FROM NEW.valid_until
  THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM public.diet_plan_versions WHERE plan_id = OLD.id;

    INSERT INTO public.diet_plan_versions
      (plan_id, title, meals, goal, goal_description, valid_until, specialist_id, version_number)
    VALUES
      (OLD.id, OLD.title, OLD.meals, OLD.goal, OLD.goal_description, OLD.valid_until, OLD.specialist_id, next_version);
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) RPC atômica para substituir plano de treino ativo
CREATE OR REPLACE FUNCTION public.replace_active_training_plan(
  p_user_id uuid,
  p_specialist_id uuid,
  p_title text,
  p_groups jsonb,
  p_total_sessions integer,
  p_avaliacao_postural text,
  p_pontos_melhoria text,
  p_objetivo_mesociclo text,
  p_progression_guide text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id uuid;
BEGIN
  -- Apenas o especialista vinculado ou admin pode executar
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.student_specialists
      WHERE student_id = p_user_id AND specialist_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.training_plans
    SET active = false
    WHERE user_id = p_user_id AND active = true;

  INSERT INTO public.training_plans (
    user_id, specialist_id, title, groups, total_sessions,
    avaliacao_postural, pontos_melhoria, objetivo_mesociclo, progression_guide, active
  ) VALUES (
    p_user_id, p_specialist_id, p_title, p_groups, p_total_sessions,
    NULLIF(p_avaliacao_postural, ''), NULLIF(p_pontos_melhoria, ''),
    NULLIF(p_objetivo_mesociclo, ''), NULLIF(p_progression_guide, ''), true
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 4) RPC atômica para substituir plano de dieta ativo
CREATE OR REPLACE FUNCTION public.replace_active_diet_plan(
  p_user_id uuid,
  p_specialist_id uuid,
  p_title text,
  p_meals jsonb,
  p_goal text,
  p_goal_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.student_specialists
      WHERE student_id = p_user_id AND specialist_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.diet_plans
    SET active = false
    WHERE user_id = p_user_id AND active = true;

  INSERT INTO public.diet_plans (
    user_id, specialist_id, title, meals, goal, goal_description, active
  ) VALUES (
    p_user_id, p_specialist_id, p_title, p_meals,
    NULLIF(p_goal, ''), NULLIF(p_goal_description, ''), true
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_active_training_plan(uuid,uuid,text,jsonb,integer,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_active_diet_plan(uuid,uuid,text,jsonb,text,text) TO authenticated;
