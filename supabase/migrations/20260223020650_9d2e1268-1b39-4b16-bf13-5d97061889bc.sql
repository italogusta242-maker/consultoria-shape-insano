
-- 1. Drop achievements table (has RLS, safe to drop)
DROP TABLE IF EXISTS public.achievements CASCADE;

-- 2. Drop gamification table (has RLS, safe to drop)
DROP TABLE IF EXISTS public.gamification CASCADE;

-- 3. Remove xp_earned and dracmas_earned from workouts
ALTER TABLE public.workouts DROP COLUMN IF EXISTS xp_earned;
ALTER TABLE public.workouts DROP COLUMN IF EXISTS dracmas_earned;

-- 4. Update handle_new_user to remove gamification insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, nome, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', NULL),
    'pendente_onboarding'
  );
  
  -- Mark invite as used if exists
  UPDATE public.invites 
  SET status = 'used', used_at = now() 
  WHERE email = NEW.email AND status = 'pending';
  
  RETURN NEW;
END;
$function$;
