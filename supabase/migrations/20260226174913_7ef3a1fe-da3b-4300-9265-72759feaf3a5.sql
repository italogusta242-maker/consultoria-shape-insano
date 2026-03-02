-- Add invoice_url column to invites to support resending payment emails
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS invoice_url text;