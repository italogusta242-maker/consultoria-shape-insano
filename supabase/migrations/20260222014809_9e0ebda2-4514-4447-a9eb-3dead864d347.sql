-- Allow students to read profiles of their linked specialists
CREATE POLICY "Students read specialist profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.student_id = auth.uid()
      AND ss.specialist_id = profiles.id
  )
);