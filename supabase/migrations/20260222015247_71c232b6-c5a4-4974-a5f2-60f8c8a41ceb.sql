-- Create a function to generate chat notifications when a message is inserted
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _participant RECORD;
  _sender_name TEXT;
  _preview_pref TEXT;
  _notif_title TEXT;
  _notif_body TEXT;
BEGIN
  -- Get sender name
  SELECT nome INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;
  _sender_name := COALESCE(_sender_name, 'Especialista');

  -- Don't create notifications for system messages
  IF NEW.type = 'system' THEN
    RETURN NEW;
  END IF;

  -- For each participant except the sender
  FOR _participant IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id != NEW.sender_id
  LOOP
    -- Get notification preview preference
    SELECT notification_preview INTO _preview_pref
    FROM public.profiles WHERE id = _participant.user_id;
    _preview_pref := COALESCE(_preview_pref, 'full');

    -- Build title and body based on preference
    IF _preview_pref = 'full' THEN
      _notif_title := _sender_name;
      IF NEW.type IN ('image', 'video') THEN
        _notif_body := '📎 Mídia';
      ELSE
        _notif_body := LEFT(NEW.content, 80);
      END IF;
    ELSIF _preview_pref = 'partial' THEN
      _notif_title := _sender_name;
      _notif_body := 'Nova mensagem';
    ELSE
      _notif_title := 'Shape Insano';
      _notif_body := 'Você recebeu uma nova mensagem';
    END IF;

    INSERT INTO public.notifications (user_id, title, body, type, metadata)
    VALUES (
      _participant.user_id,
      _notif_title,
      _notif_body,
      'chat',
      jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_chat_message_notify ON public.chat_messages;
CREATE TRIGGER on_chat_message_notify
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();