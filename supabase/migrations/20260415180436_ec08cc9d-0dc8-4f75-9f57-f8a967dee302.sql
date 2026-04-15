CREATE POLICY "Users delete own monthly assessments"
ON public.monthly_assessments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);