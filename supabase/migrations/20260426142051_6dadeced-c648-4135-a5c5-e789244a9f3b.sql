-- Lower minimum competitor threshold from 2 to 1 for local benchmark
CREATE OR REPLACE FUNCTION public.get_restaurant_local_benchmark(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  match_level text,
  competitor_count integer,
  avg_visits numeric,
  avg_conversion_rate numeric,
  city text,
  postal_code text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $$
DECLARE
  v_chain_id uuid;
  v_city text;
  v_postal_code text;
  v_city_norm text;
  v_count integer;
  v_match text := 'none';
  v_avg_visits numeric := 0;
  v_avg_conv numeric := 0;
BEGIN
  SELECT r.chain_id, r.city, r.postal_code
  INTO v_chain_id, v_city, v_postal_code
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;

  IF v_chain_id IS NULL THEN
    RETURN QUERY SELECT 'none'::text, 0, 0::numeric, 0::numeric, v_city, v_postal_code;
    RETURN;
  END IF;

  v_city_norm := public.normalize_city_name(v_city);

  -- Step 1: city match
  WITH competitors AS (
    SELECT r.id
    FROM public.restaurants r
    WHERE r.chain_id IS NOT NULL
      AND r.chain_id <> v_chain_id
      AND v_city_norm <> ''
      AND public.normalize_city_name(r.city) = v_city_norm
  ),
  agg AS (
    SELECT 
      dc.restaurant_id,
      SUM(dc.visits)::numeric AS visits,
      SUM(dc.orders)::numeric AS orders
    FROM public.daily_conversion dc
    INNER JOIN competitors c ON c.id = dc.restaurant_id
    WHERE dc.date >= p_start_date 
      AND dc.date <= p_end_date
    GROUP BY dc.restaurant_id
    HAVING SUM(dc.visits) > 0
  )
  SELECT 
    COUNT(*)::integer,
    COALESCE(AVG(a.visits), 0),
    COALESCE(AVG(CASE WHEN a.visits > 0 THEN (a.orders / a.visits) * 100 ELSE 0 END), 0)
  INTO v_count, v_avg_visits, v_avg_conv
  FROM agg a;

  IF v_count >= 1 THEN
    v_match := 'city';
    RETURN QUERY SELECT v_match, v_count, ROUND(v_avg_visits, 0), ROUND(v_avg_conv, 4), v_city, v_postal_code;
    RETURN;
  END IF;

  -- Step 2: postal_code fallback
  IF v_postal_code IS NOT NULL AND v_postal_code <> '' THEN
    WITH competitors AS (
      SELECT r.id
      FROM public.restaurants r
      WHERE r.chain_id IS NOT NULL
        AND r.chain_id <> v_chain_id
        AND r.postal_code = v_postal_code
    ),
    agg AS (
      SELECT 
        dc.restaurant_id,
        SUM(dc.visits)::numeric AS visits,
        SUM(dc.orders)::numeric AS orders
      FROM public.daily_conversion dc
      INNER JOIN competitors c ON c.id = dc.restaurant_id
      WHERE dc.date >= p_start_date 
        AND dc.date <= p_end_date
      GROUP BY dc.restaurant_id
      HAVING SUM(dc.visits) > 0
    )
    SELECT 
      COUNT(*)::integer,
      COALESCE(AVG(a.visits), 0),
      COALESCE(AVG(CASE WHEN a.visits > 0 THEN (a.orders / a.visits) * 100 ELSE 0 END), 0)
    INTO v_count, v_avg_visits, v_avg_conv
    FROM agg a;

    IF v_count >= 1 THEN
      v_match := 'postal_code';
      RETURN QUERY SELECT v_match, v_count, ROUND(v_avg_visits, 0), ROUND(v_avg_conv, 4), v_city, v_postal_code;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT 'none'::text, COALESCE(v_count, 0), 0::numeric, 0::numeric, v_city, v_postal_code;
END;
$$;