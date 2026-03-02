
-- Fix: Create the missing trigger for auto-creating profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Fix profiles RLS: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Especialistas read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Especialistas read profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'especialista'::app_role));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Fix anamnese RLS
DROP POLICY IF EXISTS "Users read own anamnese" ON public.anamnese;
DROP POLICY IF EXISTS "Admins read all anamnese" ON public.anamnese;
DROP POLICY IF EXISTS "Especialistas read anamnese" ON public.anamnese;
DROP POLICY IF EXISTS "Users insert own anamnese" ON public.anamnese;

CREATE POLICY "Users read own anamnese" ON public.anamnese FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all anamnese" ON public.anamnese FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Especialistas read anamnese" ON public.anamnese FOR SELECT USING (has_role(auth.uid(), 'especialista'::app_role));
CREATE POLICY "Users insert own anamnese" ON public.anamnese FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fix achievements RLS
DROP POLICY IF EXISTS "Users read own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users insert own achievements" ON public.achievements;

CREATE POLICY "Users read own achievements" ON public.achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own achievements" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fix gamification RLS
DROP POLICY IF EXISTS "Users read own gamification" ON public.gamification;
DROP POLICY IF EXISTS "All authenticated read gamification for ranking" ON public.gamification;
DROP POLICY IF EXISTS "Users update own gamification" ON public.gamification;

CREATE POLICY "Users read own gamification" ON public.gamification FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "All authenticated read gamification for ranking" ON public.gamification FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users update own gamification" ON public.gamification FOR UPDATE USING (auth.uid() = user_id);

-- Fix user_roles RLS
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix workouts RLS
DROP POLICY IF EXISTS "Users CRUD own workouts" ON public.workouts;

CREATE POLICY "Users CRUD own workouts" ON public.workouts FOR ALL USING (auth.uid() = user_id);

-- Allow profiles INSERT for the trigger
CREATE POLICY "System insert profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
