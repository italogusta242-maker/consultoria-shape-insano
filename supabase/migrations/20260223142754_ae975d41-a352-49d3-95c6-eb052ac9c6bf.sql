
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send push notification via edge function when notification is inserted
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
  _payload jsonb;
BEGIN
  -- Build the payload
  _payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'title', NEW.title,
    'body', COALESCE(NEW.body, ''),
    'data', COALESCE(NEW.metadata, '{}'::jsonb)
  );

  -- Get Supabase URL from app_settings or use env
  SELECT value INTO _supabase_url FROM public.app_settings WHERE key = 'supabase_url';
  SELECT value INTO _service_key FROM public.app_settings WHERE key = 'service_role_key';

  -- If we have the URL and key, make the HTTP call
  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := _supabase_url || '/functions/v1/push-notifications?action=send-to-user',
      body := _payload::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key,
        'apikey', _service_key
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_send_push ON public.notifications;
CREATE TRIGGER on_notification_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification();
