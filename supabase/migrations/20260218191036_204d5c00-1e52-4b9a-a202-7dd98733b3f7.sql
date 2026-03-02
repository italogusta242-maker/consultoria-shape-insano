
-- Training plans created by specialists for users
CREATE TABLE public.training_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  specialist_id UUID,
  title TEXT NOT NULL DEFAULT 'Plano Personalizado',
  groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_sessions INTEGER NOT NULL DEFAULT 50,
  valid_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

-- Users can read their own plans
CREATE POLICY "Users read own training plans"
ON public.training_plans FOR SELECT
USING (auth.uid() = user_id);

-- Specialists can CRUD plans (they create for users)
CREATE POLICY "Especialistas manage training plans"
ON public.training_plans FOR ALL
USING (has_role(auth.uid(), 'especialista'::app_role));

-- Admins can read all
CREATE POLICY "Admins read all training plans"
ON public.training_plans FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add effort_rating, comment, group_name to workouts
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS effort_rating INTEGER;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.training_plans(id);
