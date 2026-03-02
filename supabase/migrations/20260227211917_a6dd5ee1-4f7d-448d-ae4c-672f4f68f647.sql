
-- Add tracking columns to invites
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS email_opened_at timestamptz;
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS payment_link_clicked_at timestamptz;

-- Enable realtime for invites
ALTER PUBLICATION supabase_realtime ADD TABLE public.invites;
