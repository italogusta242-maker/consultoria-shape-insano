
-- Update the trigger function to use anon key (public, safe to store)
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
  _payload jsonb;
  _request_id bigint;
BEGIN
  -- Build the payload
  _payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'title', NEW.title,
    'body', COALESCE(NEW.body, ''),
    'data', COALESCE(NEW.metadata, '{}'::jsonb)
  );

  -- Get Supabase URL and anon key from app_settings
  SELECT value INTO _supabase_url FROM public.app_settings WHERE key = 'supabase_url';
  SELECT value INTO _anon_key FROM public.app_settings WHERE key = 'supabase_anon_key';

  -- If we have the URL and key, make the HTTP call via pg_net
  IF _supabase_url IS NOT NULL AND _anon_key IS NOT NULL THEN
    SELECT net.http_post(
      url := _supabase_url || '/functions/v1/push-notifications?action=send-to-user',
      body := _payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', _anon_key
      )
    ) INTO _request_id;
  END IF;

  RETURN NEW;
END;
$$;
