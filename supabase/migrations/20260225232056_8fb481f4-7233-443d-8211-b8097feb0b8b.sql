
-- Remove overly permissive policy (service role bypasses RLS anyway)
DROP POLICY "Service role manage flame status" ON public.flame_status;
