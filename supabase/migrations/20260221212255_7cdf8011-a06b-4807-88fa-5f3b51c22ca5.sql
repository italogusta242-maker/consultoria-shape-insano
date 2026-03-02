-- Allow admins to update any profile (needed for authorize/reject students)
CREATE POLICY "Admins update all profiles"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow CS to read all profiles
CREATE POLICY "CS read all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'cs'));

-- Allow closers to read all profiles
CREATE POLICY "Closers read all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'closer'));