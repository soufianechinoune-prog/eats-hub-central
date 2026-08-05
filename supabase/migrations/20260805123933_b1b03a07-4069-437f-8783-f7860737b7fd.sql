DROP FUNCTION IF EXISTS public.get_splash_onsite_monthly(uuid, uuid[], integer);

CREATE OR REPLACE FUNCTION public.get_splash_onsite_monthly(
  p_chain_id uuid,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_year integer DEFAULT NULL
)
RETURNS TABLE (
  restaurant_id uuid,
  restaurant_name text,
  year_bucket integer,
  month_num integer,
  revenue_onsite_ttc numeric,
  revenue_onsite_ht numeric,
  orders_onsite integer,
  days_count integer,
  days_zero integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := COALESCE(p_year, EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Paris'))::int);
BEGIN
  IF NOT (public.is_super_admin() OR public.user_has_chain_access(p_chain_id)) THEN
    RAISE EXCEPTION 'Access denied for chain %', p_chain_id;
  END IF;

  RETURN QUERY
  WITH daily AS (
    SELECT
      s.restaurant_id AS rid,
      s.date AS d,
      COALESCE(SUM(s.revenue_ttc) FILTER (WHERE s.platform = 'global'), 0) AS onsite_ttc,
      COALESCE(SUM(s.revenue_ht) FILTER (WHERE s.platform = 'global'), 0) AS onsite_ht,
      COALESCE(SUM(s.order_count) FILTER (WHERE s.platform = 'global'), 0)::int AS onsite_orders
    FROM public.splash360_daily_sales s
    WHERE s.chain_id = p_chain_id
      AND s.granularity = 'day'
      AND s.restaurant_splash_id <> 0
      AND s.restaurant_id IS NOT NULL
      AND (p_restaurant_ids IS NULL OR s.restaurant_id = ANY(p_restaurant_ids))
      AND EXTRACT(YEAR FROM s.date)::int IN (v_year, v_year - 1)
    GROUP BY s.restaurant_id, s.date
  )
  SELECT
    daily.rid,
    r.name::text,
    EXTRACT(YEAR FROM daily.d)::int,
    EXTRACT(MONTH FROM daily.d)::int,
    SUM(daily.onsite_ttc)::numeric,
    SUM(daily.onsite_ht)::numeric,
    SUM(daily.onsite_orders)::int,
    COUNT(*) FILTER (WHERE daily.onsite_ttc > 0)::int,
    COUNT(*) FILTER (WHERE daily.onsite_ttc <= 0)::int
  FROM daily
  JOIN public.restaurants r ON r.id = daily.rid
  GROUP BY daily.rid, r.name, EXTRACT(YEAR FROM daily.d), EXTRACT(MONTH FROM daily.d)
  ORDER BY r.name, 3, 4;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_splash_onsite_monthly(uuid, uuid[], integer) TO authenticated;