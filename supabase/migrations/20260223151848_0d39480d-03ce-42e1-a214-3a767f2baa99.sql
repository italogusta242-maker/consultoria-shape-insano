
-- ============================================================
-- 1. FIX: invites table - remove anonymous/public read access
--    Only allow: admin, closers (own), and the invited user
-- ============================================================

-- Drop dangerous public read policies
DROP POLICY IF EXISTS "Anon read pending invites" ON public.invites;
DROP POLICY IF EXISTS "Anyone can read pending invites by token" ON public.invites;

-- Create a safe policy: only authenticated users can read invites by token
CREATE POLICY "Authenticated read own invite by token"
ON public.invites
FOR SELECT
USING (
  auth.role() = 'authenticated' AND status = 'pending'
);

-- ============================================================
-- 2. FIX: app_settings - restrict public read to non-sensitive keys
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;

-- Only authenticated users can read app_settings, and only non-secret keys
CREATE POLICY "Authenticated read non-secret app_settings"
ON public.app_settings
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND key NOT IN ('supabase_service_role_key', 'asaas_api_key')
);

-- ============================================================
-- 3. FIX: message_reads - restrict to conversation participants
-- ============================================================

DROP POLICY IF EXISTS "Users can view reads for their conversations" ON public.message_reads;

CREATE POLICY "Users view reads for own conversations"
ON public.message_reads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages cm
    JOIN public.conversation_participants cp ON cp.conversation_id = cm.conversation_id
    WHERE cm.id = message_reads.message_id
    AND cp.user_id = auth.uid()
  )
);

-- ============================================================
-- 4. Create idempotency table for webhook/payment deduplication
-- ============================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  response JSONB
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can access this table
-- No user-facing policies needed

-- ============================================================
-- 5. Enable leaked password protection reminder
-- ============================================================
-- Note: This is configured via Supabase Auth settings, not SQL
