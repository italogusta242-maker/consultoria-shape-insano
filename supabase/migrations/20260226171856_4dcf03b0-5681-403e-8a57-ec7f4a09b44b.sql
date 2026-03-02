
-- =============================================================
-- FIX 1: idempotency_keys - Remove overly permissive policy
-- The service_role bypasses RLS, so no replacement policy needed.
-- This prevents authenticated/anon users from accessing payment data.
-- =============================================================
DROP POLICY IF EXISTS "Service role manage idempotency_keys" ON public.idempotency_keys;

-- =============================================================
-- FIX 2: invites - Restrict SELECT to user's own email only
-- Previously any authenticated user could read ALL pending invites.
-- =============================================================
DROP POLICY IF EXISTS "Authenticated read own invite by token" ON public.invites;

CREATE POLICY "Users read own pending invite"
ON public.invites
FOR SELECT
TO authenticated
USING (
  status = 'pending' 
  AND email = (auth.jwt()->>'email')
);
