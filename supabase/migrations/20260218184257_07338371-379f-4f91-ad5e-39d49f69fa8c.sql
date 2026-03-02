
ALTER TABLE public.gamification DROP COLUMN IF EXISTS league;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS classe;
DROP TYPE IF EXISTS league_type;
DROP TYPE IF EXISTS classe_type;
