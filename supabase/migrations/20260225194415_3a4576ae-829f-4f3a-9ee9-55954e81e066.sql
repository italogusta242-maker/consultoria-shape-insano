
-- Add specialist analysis fields to training_plans
ALTER TABLE public.training_plans
  ADD COLUMN avaliacao_postural text,
  ADD COLUMN pontos_melhoria text,
  ADD COLUMN objetivo_mesociclo text;
