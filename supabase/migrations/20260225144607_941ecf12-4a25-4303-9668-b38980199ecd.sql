
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'PIX',
ADD COLUMN IF NOT EXISTS max_installments integer NOT NULL DEFAULT 1;
