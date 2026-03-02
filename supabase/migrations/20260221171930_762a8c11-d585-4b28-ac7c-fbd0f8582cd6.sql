
-- Module 5: Add body_fat column to profiles (specialist-managed)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS body_fat numeric;

-- Module 4: Create trigger function for plan notifications
CREATE OR REPLACE FUNCTION public.notify_plan_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  plan_type text;
  plan_title text;
BEGIN
  IF TG_TABLE_NAME = 'training_plans' THEN
    plan_type := 'treino';
    plan_title := NEW.title;
  ELSE
    plan_type := 'dieta';
    plan_title := NEW.title;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, metadata)
  VALUES (
    NEW.user_id,
    CASE WHEN plan_type = 'treino' THEN '💪 Novo Plano de Treino' ELSE '🍎 Novo Plano Alimentar' END,
    'Seu ' || plan_type || ' "' || plan_title || '" está disponível!',
    'plan',
    jsonb_build_object('plan_type', plan_type, 'plan_id', NEW.id)
  );

  RETURN NEW;
END;
$function$;

-- Create triggers on training_plans and diet_plans
CREATE TRIGGER notify_training_plan_created
AFTER INSERT ON public.training_plans
FOR EACH ROW
EXECUTE FUNCTION public.notify_plan_created();

CREATE TRIGGER notify_diet_plan_created
AFTER INSERT ON public.diet_plans
FOR EACH ROW
EXECUTE FUNCTION public.notify_plan_created();
