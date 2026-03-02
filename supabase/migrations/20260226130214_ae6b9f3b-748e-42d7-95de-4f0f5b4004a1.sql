
-- Add RLS policies for idempotency_keys (used by edge functions with service role)
CREATE POLICY "Service role manage idempotency_keys"
ON public.idempotency_keys
FOR ALL
USING (true)
WITH CHECK (true);
