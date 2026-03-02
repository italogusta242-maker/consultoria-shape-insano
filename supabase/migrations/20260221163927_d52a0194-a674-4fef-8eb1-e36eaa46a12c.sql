
-- Push subscriptions table
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- App settings for VAPID keys (public readable, only service role can write)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT USING (true);

-- Trigger: insert notifications on new chat messages for all participants
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  participant RECORD;
  sender_name text;
  msg_preview text;
BEGIN
  SELECT nome INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  IF sender_name IS NULL THEN sender_name := 'Usuário'; END IF;

  IF NEW.type = 'text' THEN
    msg_preview := LEFT(NEW.content, 100);
  ELSE
    msg_preview := '📎 Mídia';
  END IF;

  FOR participant IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id != NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, title, body, type, metadata)
    VALUES (
      participant.user_id,
      sender_name,
      msg_preview,
      'chat',
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_chat_message_notify
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();
