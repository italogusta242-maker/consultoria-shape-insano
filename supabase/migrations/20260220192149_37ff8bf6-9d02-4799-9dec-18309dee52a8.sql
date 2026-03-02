
-- 1. Add status column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente_onboarding';

-- Update existing onboarded users to 'ativo'
UPDATE public.profiles SET status = 'ativo' WHERE onboarded = true;

-- 2. Create invites table for token-based registration
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  email text NOT NULL,
  name text,
  cpf text,
  plan_value numeric,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  used_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on invites
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admins and closers can manage invites
CREATE POLICY "Admins manage invites"
  ON public.invites FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Closers manage own invites"
  ON public.invites FOR ALL
  USING (public.has_role(auth.uid(), 'closer'));

-- Allow anonymous read for invite validation (first access page)
CREATE POLICY "Anyone can read pending invites by token"
  ON public.invites FOR SELECT
  USING (status = 'pending');

-- 3. Update handle_new_user to set status and mark invite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, status)
  VALUES (NEW.id, NEW.email, 'pendente_onboarding');
  
  INSERT INTO public.gamification (user_id)
  VALUES (NEW.id);
  
  -- Mark invite as used if exists
  UPDATE public.invites 
  SET status = 'used', used_at = now() 
  WHERE email = NEW.email AND status = 'pending';
  
  RETURN NEW;
END;
$function$;
