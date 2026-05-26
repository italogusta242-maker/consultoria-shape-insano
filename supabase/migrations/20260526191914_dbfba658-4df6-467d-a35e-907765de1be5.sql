ALTER TABLE public.training_plans ADD COLUMN IF NOT EXISTS progression_guide text;
ALTER TABLE public.training_plan_versions ADD COLUMN IF NOT EXISTS progression_guide text;

CREATE OR REPLACE FUNCTION public.snapshot_training_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_version INTEGER;
BEGIN
  IF OLD.groups IS DISTINCT FROM NEW.groups OR OLD.title IS DISTINCT FROM NEW.title THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM public.training_plan_versions WHERE plan_id = OLD.id;

    INSERT INTO public.training_plan_versions (plan_id, title, groups, total_sessions, avaliacao_postural, objetivo_mesociclo, pontos_melhoria, progression_guide, valid_until, specialist_id, version_number)
    VALUES (OLD.id, OLD.title, OLD.groups, OLD.total_sessions, OLD.avaliacao_postural, OLD.objetivo_mesociclo, OLD.pontos_melhoria, OLD.progression_guide, OLD.valid_until, OLD.specialist_id, next_version);
  END IF;
  RETURN NEW;
END;
$function$;