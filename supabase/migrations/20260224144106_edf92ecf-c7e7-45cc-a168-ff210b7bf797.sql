
-- Function to get last message per conversation in a single call
-- This replaces N individual queries with 1
CREATE OR REPLACE FUNCTION public.get_last_messages(conv_ids uuid[])
RETURNS TABLE(conversation_id uuid, content text, created_at timestamptz, sender_id uuid, type text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (cm.conversation_id)
    cm.conversation_id,
    cm.content,
    cm.created_at,
    cm.sender_id,
    cm.type
  FROM chat_messages cm
  WHERE cm.conversation_id = ANY(conv_ids)
  ORDER BY cm.conversation_id, cm.created_at DESC;
$$;
