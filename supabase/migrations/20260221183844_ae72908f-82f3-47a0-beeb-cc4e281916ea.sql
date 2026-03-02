-- Fix invites RLS: change from RESTRICTIVE to PERMISSIVE so closers/admins can insert
DROP POLICY IF EXISTS "Admins manage invites" ON public.invites;
DROP POLICY IF EXISTS "Anyone can read pending invites by token" ON public.invites;
DROP POLICY IF EXISTS "Closers manage own invites" ON public.invites;

CREATE POLICY "Admins manage invites" ON public.invites FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read pending invites by token" ON public.invites FOR SELECT TO authenticated USING (status = 'pending'::text);

CREATE POLICY "Closers manage own invites" ON public.invites FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'closer'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'closer'::app_role));

-- Also allow anon to read pending invites (for the invite page)
CREATE POLICY "Anon read pending invites" ON public.invites FOR SELECT TO anon USING (status = 'pending'::text);