-- Allow specialists to insert notifications for their students
CREATE POLICY "Specialists insert notifications for students"
ON public.notifications
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'especialista'::app_role)
);
