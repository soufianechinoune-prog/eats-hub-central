CREATE OR REPLACE FUNCTION public.get_splash_onsite_monthly_v2(p_chain_id uuid, p_restaurant_ids uuid[] DEFAULT NULL::uuid[], p_year integer DEFAULT NULL::integer)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer := COALESCE(p_year, EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Paris'))::int);
  v_result jsonb;
BEGIN
  IF NOT (public.is_super_admin() OR public.user_has_chain_access(p_chain_id)) THEN
    RAISE EXCEPTION 'Access denied for chain %', p_chain_id;
  END IF;
  WITH daily AS (
    SELECT s.restaurant_id AS rid, s.date AS d,
      COALESCE(SUM(s.revenue_ttc) FILTER (WHERE s.platform = 'global'), 0) AS onsite_ttc,
      COALESCE(SUM(s.revenue_ht) FILTER (WHERE s.platform = 'global'), 0) AS onsite_ht,
      COALESCE(SUM(s.order_count) FILTER (WHERE s.platform = 'global'), 0)::int AS onsite_orders
    FROM public.splash360_daily_sales s
    WHERE s.chain_id = p_chain_id AND s.granularity = 'day' AND s.restaurant_splash_id <> 0 AND s.restaurant_id IS NOT NULL
      AND (p_restaurant_ids IS NULL OR s.restaurant_id = ANY(p_restaurant_ids))
      AND EXTRACT(YEAR FROM s.date)::int IN (v_year, v_year - 1)
    GROUP BY s.restaurant_id, s.date
  ),
  active AS (
    SELECT daily.rid, EXTRACT(YEAR FROM daily.d)::int AS yy,
      MIN(daily.d) FILTER (WHERE daily.onsite_ttc > 0) AS first_ok,
      MAX(daily.d) FILTER (WHERE daily.onsite_ttc > 0) AS last_ok
    FROM daily GROUP BY daily.rid, EXTRACT(YEAR FROM daily.d)
  ),
  monthly AS (
    SELECT daily.rid, r.name::text AS rname,
      EXTRACT(YEAR FROM daily.d)::int AS y, EXTRACT(MONTH FROM daily.d)::int AS m,
      SUM(daily.onsite_ttc)::numeric AS ttc, SUM(daily.onsite_ht)::numeric AS ht, SUM(daily.onsite_orders)::int AS orders,
      COUNT(*) FILTER (WHERE daily.onsite_ttc > 0)::int AS days_count,
      COUNT(*) FILTER (WHERE daily.onsite_ttc <= 0)::int AS days_zero,
      COUNT(*) FILTER (WHERE daily.onsite_ttc <= 0 AND a.first_ok IS NOT NULL AND daily.d > a.first_ok AND daily.d < a.last_ok)::int AS days_gap
    FROM daily JOIN public.restaurants r ON r.id = daily.rid
    JOIN active a ON a.rid = daily.rid AND a.yy = EXTRACT(YEAR FROM daily.d)::int
    GROUP BY daily.rid, r.name, EXTRACT(YEAR FROM daily.d), EXTRACT(MONTH FROM daily.d)
  ),
  per_resto AS (
    SELECT monthly.rid, monthly.rname,
      jsonb_agg(jsonb_build_object('y', monthly.y, 'm', monthly.m, 'ttc', monthly.ttc, 'ht', monthly.ht,
        'orders', monthly.orders, 'days_count', monthly.days_count, 'days_zero', monthly.days_zero, 'days_gap', monthly.days_gap
      ) ORDER BY monthly.y, monthly.m) AS months
    FROM monthly GROUP BY monthly.rid, monthly.rname
  ),
  unmapped AS (
    SELECT COUNT(DISTINCT s.restaurant_splash_id)::int AS ids,
      COALESCE(SUM(s.revenue_ttc) FILTER (WHERE s.platform = 'global'), 0)::numeric AS ttc
    FROM public.splash360_daily_sales s
    WHERE s.chain_id = p_chain_id AND s.granularity = 'day' AND s.restaurant_splash_id <> 0 AND s.restaurant_id IS NULL
      AND EXTRACT(YEAR FROM s.date)::int = v_year
  )
  SELECT jsonb_build_object('year', v_year,
    'restaurants', COALESCE((SELECT jsonb_agg(jsonb_build_object('restaurant_id', per_resto.rid, 'name', per_resto.rname, 'months', per_resto.months) ORDER BY per_resto.rname) FROM per_resto), '[]'::jsonb),
    'coverage', jsonb_build_object(
      'days_zero_current', COALESCE((SELECT SUM(monthly.days_zero) FROM monthly WHERE monthly.y = v_year), 0),
      'days_gap_current', COALESCE((SELECT SUM(monthly.days_gap) FROM monthly WHERE monthly.y = v_year), 0),
      'unmapped_splash_ids', (SELECT unmapped.ids FROM unmapped),
      'unmapped_revenue_ttc', (SELECT unmapped.ttc FROM unmapped)
    )
  ) INTO v_result;
  RETURN COALESCE(v_result, jsonb_build_object('year', v_year, 'restaurants', '[]'::jsonb, 'coverage', jsonb_build_object('days_zero_current', 0, 'days_gap_current', 0, 'unmapped_splash_ids', 0, 'unmapped_revenue_ttc', 0)));
END;
$function$;