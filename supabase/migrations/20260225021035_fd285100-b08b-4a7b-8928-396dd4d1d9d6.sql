
-- Create food_measures table for household measurement units
CREATE TABLE public.food_measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES public.food_database(id) ON DELETE CASCADE,
  description TEXT NOT NULL,           -- e.g. "Fatia média", "Colher de sopa", "Unidade"
  gram_equivalent DECIMAL(10,2) NOT NULL, -- how many grams this measure represents
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by food_id
CREATE INDEX idx_food_measures_food_id ON public.food_measures(food_id);

-- Enable RLS
ALTER TABLE public.food_measures ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read measures
CREATE POLICY "Authenticated users read food measures"
  ON public.food_measures FOR SELECT
  USING (true);

-- Specialists and nutritionists can manage measures
CREATE POLICY "Especialistas manage food measures"
  ON public.food_measures FOR ALL
  USING (has_role(auth.uid(), 'especialista'::app_role))
  WITH CHECK (has_role(auth.uid(), 'especialista'::app_role));

CREATE POLICY "Nutricionista manage food measures"
  ON public.food_measures FOR ALL
  USING (has_role(auth.uid(), 'nutricionista'::app_role))
  WITH CHECK (has_role(auth.uid(), 'nutricionista'::app_role));

CREATE POLICY "Personal manage food measures"
  ON public.food_measures FOR ALL
  USING (has_role(auth.uid(), 'personal'::app_role))
  WITH CHECK (has_role(auth.uid(), 'personal'::app_role));

CREATE POLICY "Admins manage food measures"
  ON public.food_measures FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
