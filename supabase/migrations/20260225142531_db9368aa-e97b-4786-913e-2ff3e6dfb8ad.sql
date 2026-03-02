
-- Add billing_type and description to subscription_plans
ALTER TABLE public.subscription_plans 
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'recurring',
  ADD COLUMN IF NOT EXISTS description text;
