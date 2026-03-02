-- Create table for metric goals (admin-configurable targets)
CREATE TABLE public.metric_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_key text NOT NULL UNIQUE,
  goal_value numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.metric_goals ENABLE ROW LEVEL SECURITY;

-- Only admins can manage goals
CREATE POLICY "Admins manage metric_goals"
ON public.metric_goals FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can read (for dashboard)
CREATE POLICY "Authenticated read metric_goals"
ON public.metric_goals FOR SELECT
USING (auth.role() = 'authenticated');

-- Seed default goals
INSERT INTO public.metric_goals (metric_key, goal_value) VALUES
  ('mrr', 50000),
  ('ltv', 3000),
  ('cac', 200),
  ('churn', 5)
ON CONFLICT (metric_key) DO NOTHING;

-- Trigger to update updated_at
CREATE TRIGGER update_metric_goals_updated_at
BEFORE UPDATE ON public.metric_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();