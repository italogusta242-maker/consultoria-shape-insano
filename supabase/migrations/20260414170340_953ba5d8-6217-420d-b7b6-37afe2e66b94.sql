-- Allow specialists to update status of their assigned students
CREATE POLICY "Specialists update assigned student status"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = profiles.id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = profiles.id
  )
);