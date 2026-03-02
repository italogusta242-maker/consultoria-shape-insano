
-- Create subscription_plans table for plan management
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- CS and Admins can manage plans
CREATE POLICY "Admins manage subscription_plans" ON public.subscription_plans
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CS manage subscription_plans" ON public.subscription_plans
  FOR ALL USING (has_role(auth.uid(), 'cs'::app_role))
  WITH CHECK (has_role(auth.uid(), 'cs'::app_role));

CREATE POLICY "Authenticated read subscription_plans" ON public.subscription_plans
  FOR SELECT USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert 3 test plans
INSERT INTO public.subscription_plans (name, duration_months, price) VALUES
  ('Plano 1', 1, 197.00),
  ('Plano 2', 3, 497.00),
  ('Plano 3', 6, 897.00);
