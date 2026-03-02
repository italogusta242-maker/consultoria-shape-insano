
-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Create accent-insensitive food search function
CREATE OR REPLACE FUNCTION public.search_foods_unaccent(
  search_term text,
  max_results integer DEFAULT 30
)
RETURNS SETOF public.food_database
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.food_database
  WHERE extensions.unaccent(lower(name)) ILIKE '%' || extensions.unaccent(lower(search_term)) || '%'
  ORDER BY length(name), name
  LIMIT max_results;
$$;
