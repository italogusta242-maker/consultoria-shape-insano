-- Allow admins to read all chat messages (needed for observer mode)
CREATE POLICY "Admins read all chat_messages"
  ON public.chat_messages
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));