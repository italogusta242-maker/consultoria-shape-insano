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
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Mark invite as used if exists
  UPDATE public.invites 
  SET status = 'used', used_at = now() 
  WHERE email = NEW.email AND status = 'pending';
  
  RETURN NEW;
END;
$function$;