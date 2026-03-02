
CREATE POLICY "Admins read all workouts"
  ON public.workouts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
