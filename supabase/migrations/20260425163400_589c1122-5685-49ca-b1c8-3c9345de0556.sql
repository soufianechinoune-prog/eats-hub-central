-- Fonction d'analyse benchmark local : retourne les points de conversion
-- des restaurants des autres marques situés dans les mêmes villes que la marque de l'utilisateur.
-- Toutes les données sont anonymisées (pas de nom, pas de restaurant_id réel).
CREATE OR REPLACE FUNCTION public.get_local_benchmark_conversion(
  p_chain_id uuid,
  p_start_date date,
  p_end_date date,
  p_platform text DEFAULT 'uber_eats'
)
RETURNS TABLE(
  anon_id text,
  city text,
  visits bigint,
  orders bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
SET statement_timeout TO '30s'
AS $$
BEGIN
  RETURN QUERY
  WITH brand_cities AS (
    -- Villes normalisées où la marque demandée est présente
    SELECT DISTINCT lower(trim(coalesce(unaccent(r.city), ''))) AS city_norm
    FROM public.restaurants r
    WHERE r.chain_id = p_chain_id
      AND r.city IS NOT NULL
      AND trim(r.city) <> ''
  ),
  competitors AS (
    -- Restaurants des AUTRES marques situés dans les mêmes villes
    SELECT
      r.id AS restaurant_id,
      r.city,
      lower(trim(coalesce(unaccent(r.city), ''))) AS city_norm
    FROM public.restaurants r
    WHERE r.chain_id IS DISTINCT FROM p_chain_id
      AND r.city IS NOT NULL
      AND lower(trim(coalesce(unaccent(r.city), ''))) IN (SELECT city_norm FROM brand_cities)
  ),
  agg AS (
    SELECT
      c.restaurant_id,
      c.city,
      COALESCE(SUM(dc.visits), 0)::bigint AS visits,
      COALESCE(SUM(dc.orders), 0)::bigint AS orders
    FROM competitors c
    LEFT JOIN public.daily_conversion dc
      ON dc.restaurant_id = c.restaurant_id
      AND dc.date BETWEEN p_start_date AND p_end_date
      AND dc.platform = p_platform
    GROUP BY c.restaurant_id, c.city
  )
  SELECT
    -- Identifiant anonyme stable (8 premiers caractères du MD5)
    -- Permet de regrouper les points côté frontend sans exposer l'UUID réel
    substring(md5(a.restaurant_id::text || '::lovable-benchmark') from 1 for 12) AS anon_id,
    a.city,
    a.visits,
    a.orders,
    CASE
      WHEN a.visits > 0 THEN ROUND((a.orders::numeric / a.visits::numeric) * 100, 4)
      ELSE 0
    END AS conversion_rate
  FROM agg a
  WHERE a.visits > 0;  -- Exclure les concurrents sans données sur la période
END;
$$;

-- Permettre l'exécution à tout utilisateur authentifié
GRANT EXECUTE ON FUNCTION public.get_local_benchmark_conversion(uuid, date, date, text) TO authenticated;