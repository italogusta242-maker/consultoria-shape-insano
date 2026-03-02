-- Monthly metric goals: one goal per metric per month
CREATE TABLE public.monthly_metric_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_key TEXT NOT NULL,
  month TEXT NOT NULL, -- format: YYYY-MM
  goal_value NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE(metric_key, month)
);

-- Enable RLS
ALTER TABLE public.monthly_metric_goals ENABLE ROW LEVEL SECURITY;

-- Admins can read
CREATE POLICY "Admins can read monthly goals"
  ON public.monthly_metric_goals
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert
CREATE POLICY "Admins can insert monthly goals"
  ON public.monthly_metric_goals
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update
CREATE POLICY "Admins can update monthly goals"
  ON public.monthly_metric_goals
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_monthly_metric_goals_updated_at
  BEFORE UPDATE ON public.monthly_metric_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();