
-- Admin pode ler todas as conversas
CREATE POLICY "Admins read all conversations"
  ON public.conversations
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin pode ler todos os participantes
CREATE POLICY "Admins read all conversation_participants"
  ON public.conversation_participants
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
