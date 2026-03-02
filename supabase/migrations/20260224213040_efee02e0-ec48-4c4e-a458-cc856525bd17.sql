
-- Add structured portion columns to food_database
ALTER TABLE food_database 
  ADD COLUMN IF NOT EXISTS portion_unit text DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS portion_amount numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS portion_grams numeric DEFAULT 100;

-- Parse existing portion text into structured columns
UPDATE food_database SET
  portion_unit = CASE
    WHEN portion ILIKE '%unidade%' THEN 'unidade'
    WHEN portion ILIKE '%colher%' THEN 'colher de sopa'
    WHEN portion ILIKE '%fatia%' THEN 'fatia'
    WHEN portion ILIKE '%ml%' THEN 'ml'
    WHEN portion ILIKE '%scoop%' THEN 'scoop'
    WHEN portion ILIKE '%xícara%' OR portion ILIKE '%xicara%' THEN 'xícara'
    ELSE 'g'
  END,
  portion_amount = COALESCE(
    (regexp_match(portion, '(\d+)'))[1]::numeric,
    1
  ),
  portion_grams = COALESCE(
    (regexp_match(portion, '\((\d+)g\)'))[1]::numeric,
    CASE 
      WHEN portion ~ '^\d+g$' THEN (regexp_match(portion, '^(\d+)'))[1]::numeric
      WHEN portion ILIKE '%ml%' THEN (regexp_match(portion, '(\d+)'))[1]::numeric
      ELSE 100 
    END
  );
