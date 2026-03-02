
-- Add subscription_plan_id and expires_at to subscriptions
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS subscription_plan_id uuid REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Create index for expiration alerts
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON public.subscriptions(expires_at);
