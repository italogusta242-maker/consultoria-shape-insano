CREATE POLICY "Users delete own message reads"
ON public.message_reads
FOR DELETE
USING (auth.uid() = user_id);