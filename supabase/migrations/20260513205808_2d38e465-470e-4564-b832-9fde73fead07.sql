-- Allow admins to fully manage user flame_status
CREATE POLICY "Admins insert flame status"
ON public.flame_status
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update flame status"
ON public.flame_status
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete flame status"
ON public.flame_status
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));