-- Active l'extension unaccent en premier
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Helper function: normalise les noms de restaurants pour fuzzy match
CREATE OR REPLACE FUNCTION public.normalize_resto_name(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(public.unaccent(coalesce(input, ''))),
      '^chicken\s*street\s*-?\s*', '', 'g'
    ),
    '[^a-z0-9]', '', 'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.splash360_auto_map_restaurants()
RETURNS TABLE(
  matched_count INTEGER,
  unmatched_count INTEGER,
  total_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched INTEGER := 0;
  v_total INTEGER := 0;
  v_unmatched INTEGER := 0;
BEGIN
  WITH candidates AS (
    SELECT
      m.restaurant_splash_id,
      r.id AS restaurant_id
    FROM public.splash360_restaurant_mapping m
    JOIN public.restaurants r
      ON public.normalize_resto_name(r.name) = public.normalize_resto_name(m.splash_name)
    WHERE m.restaurant_id IS NULL
  ),
  alias_map AS (
    SELECT * FROM (VALUES
      ('garges',         'Chicken Street - Garges-lès-Gonesse'),
      ('bussystgeorge',  'Chicken Street - Bussy-Saint-Georges'),
      ('chalonssaone',   'Chicken Street - Chalon'),
      ('bordeauxmerignac','Chicken Street - Merignac'),
      ('boulogne',       'Chicken Street - Boulogne-Billancourt'),
      ('kremlin',        'Chicken Street - Kremlin-Bicêtre'),
      ('athismons',      'Chicken Street - Athis-Mons'),
      ('montpellier',    'Chicken street - Montpellier Comédie'),
      ('marseillestantoine','Chicken Street - Marseille'),
      ('besancon',       'Chicken Street - Besançon'),
      ('lilleflandre',   'Chicken Street - Lille Flandres'),
      ('lyon6',          'Chicken Street - Lyon 6eme'),
      ('lyon1',          'Chicken Street - Lyon Sainte Catherine')
    ) AS t(splash_norm, resto_name)
  ),
  alias_candidates AS (
    SELECT
      m.restaurant_splash_id,
      r.id AS restaurant_id
    FROM public.splash360_restaurant_mapping m
    JOIN alias_map a ON public.normalize_resto_name(m.splash_name) = a.splash_norm
    JOIN public.restaurants r ON r.name = a.resto_name
    WHERE m.restaurant_id IS NULL
  ),
  all_candidates AS (
    SELECT * FROM candidates
    UNION
    SELECT * FROM alias_candidates
  ),
  upd AS (
    UPDATE public.splash360_restaurant_mapping m
    SET restaurant_id = c.restaurant_id,
        matched_at = now()
    FROM all_candidates c
    WHERE m.restaurant_splash_id = c.restaurant_splash_id
    RETURNING m.restaurant_splash_id
  )
  SELECT count(*) INTO v_matched FROM upd;

  SELECT count(*) INTO v_total FROM public.splash360_restaurant_mapping;
  SELECT count(*) INTO v_unmatched FROM public.splash360_restaurant_mapping WHERE restaurant_id IS NULL;

  RETURN QUERY SELECT v_matched, v_unmatched, v_total;
END;
$$;