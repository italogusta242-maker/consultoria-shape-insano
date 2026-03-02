
-- Daily habits tracking (water intake + completed meals)
CREATE TABLE public.daily_habits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  water_liters NUMERIC NOT NULL DEFAULT 0,
  completed_meals TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_habits ENABLE ROW LEVEL SECURITY;

-- Users can read their own habits
CREATE POLICY "Users read own daily habits"
  ON public.daily_habits FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own habits
CREATE POLICY "Users insert own daily habits"
  ON public.daily_habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own habits
CREATE POLICY "Users update own daily habits"
  ON public.daily_habits FOR UPDATE
  USING (auth.uid() = user_id);

-- Specialists can read habits for monitoring
CREATE POLICY "Especialistas read daily habits"
  ON public.daily_habits FOR SELECT
  USING (has_role(auth.uid(), 'especialista'::app_role));

-- Admins can read all habits
CREATE POLICY "Admins read all daily habits"
  ON public.daily_habits FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp
CREATE TRIGGER update_daily_habits_updated_at
  BEFORE UPDATE ON public.daily_habits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
