
-- 1. Add 'cs' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cs';

-- 2. Create food_database table
CREATE TABLE public.food_database (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  portion text NOT NULL DEFAULT '100g',
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric DEFAULT 0,
  category text NOT NULL DEFAULT 'outros',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.food_database ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read food database
CREATE POLICY "Authenticated users read food database"
ON public.food_database FOR SELECT
TO authenticated
USING (true);

-- Especialistas can manage food items
CREATE POLICY "Especialistas manage food database"
ON public.food_database FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'especialista'::app_role));

-- Admins can manage food items
CREATE POLICY "Admins manage food database"
ON public.food_database FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_food_database_updated_at
BEFORE UPDATE ON public.food_database
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
