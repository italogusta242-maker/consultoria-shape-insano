
-- 1. Add 'fonte' column to food_database (TACO or TBCA)
ALTER TABLE public.food_database ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'TBCA';

-- Mark all existing rows as TBCA
UPDATE public.food_database SET fonte = 'TBCA' WHERE fonte IS NULL;

-- 2. Create food_favorites table (per-specialist favorites)
CREATE TABLE public.food_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL,
  food_id UUID NOT NULL REFERENCES public.food_database(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(specialist_id, food_id)
);

ALTER TABLE public.food_favorites ENABLE ROW LEVEL SECURITY;

-- Specialists can manage their own favorites
CREATE POLICY "Users manage own food favorites"
  ON public.food_favorites
  FOR ALL
  USING (auth.uid() = specialist_id)
  WITH CHECK (auth.uid() = specialist_id);

-- Index for fast lookup
CREATE INDEX idx_food_favorites_specialist ON public.food_favorites(specialist_id);

-- 3. Add full-text search index on food_database.name for faster Portuguese search
CREATE INDEX IF NOT EXISTS idx_food_database_name_fts ON public.food_database USING gin (to_tsvector('portuguese', name));
