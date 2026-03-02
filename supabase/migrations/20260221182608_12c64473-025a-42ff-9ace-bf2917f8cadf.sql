
-- Add notification preview preference to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preview text NOT NULL DEFAULT 'full';
-- Values: 'full' (sender + message), 'partial' (sender + truncated), 'none' (generic "Nova mensagem")

COMMENT ON COLUMN public.profiles.notification_preview IS 'Controls message preview in notifications: full, partial, none';
