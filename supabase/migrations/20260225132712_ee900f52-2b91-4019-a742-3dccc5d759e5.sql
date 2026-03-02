
-- Add goal column to diet_plans
ALTER TABLE public.diet_plans
ADD COLUMN goal text NOT NULL DEFAULT 'manutenção';
