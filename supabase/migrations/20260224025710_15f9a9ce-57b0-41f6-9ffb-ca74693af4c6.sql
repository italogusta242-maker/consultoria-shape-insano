-- Allow authenticated users to find CS agents for support chat
CREATE POLICY "Authenticated users find cs agents"
ON public.user_roles
FOR SELECT
USING (
  auth.role() = 'authenticated' AND role = 'cs'
);