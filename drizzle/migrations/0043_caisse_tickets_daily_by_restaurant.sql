CREATE OR REPLACE FUNCTION public.get_caisse_tickets_daily_by_restaurant(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(restaurant_id uuid, date date, tickets bigint, prev_tickets bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '30s'
AS $$
  WITH s AS (
    SELECT d.restaurant_id, d.date, SUM(COALESCE(d.order_count,0)) o
    FROM splash360_daily_sales d
    WHERE d.granularity='day' AND d.platform='global' AND d.restaurant_splash_id<>0
      AND d.restaurant_id = ANY(p_restaurant_ids)
      AND public.user_has_chain_access(d.chain_id)
      AND (d.date BETWEEN p_start AND p_end OR d.date BETWEEN (p_start - interval '1 year')::date AND (p_end - interval '1 year')::date)
    GROUP BY d.restaurant_id, d.date
  ), c AS (
    SELECT a.restaurant_id, a.date, SUM(COALESCE(a.order_count,0)) o
    FROM chataigne_daily_analytics a
    WHERE a.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(a.chain_id)
      AND (a.date BETWEEN p_start AND p_end OR a.date BETWEEN (p_start - interval '1 year')::date AND (p_end - interval '1 year')::date)
    GROUP BY a.restaurant_id, a.date
  ), n AS (
    SELECT s.restaurant_id, s.date, GREATEST(s.o - COALESCE(c.o,0),0)::bigint o
    FROM s LEFT JOIN c ON c.restaurant_id=s.restaurant_id AND c.date=s.date
  ), days AS (SELECT generate_series(p_start, p_end, interval '1 day')::date d),
  grid AS (SELECT r.id AS rid, days.d FROM unnest(p_restaurant_ids) r(id) CROSS JOIN days)
  SELECT grid.rid, grid.d, COALESCE(cur.o,0), COALESCE(pr.o,0)
  FROM grid
  LEFT JOIN n cur ON cur.restaurant_id=grid.rid AND cur.date=grid.d
  LEFT JOIN n pr ON pr.restaurant_id=grid.rid AND pr.date=(grid.d - interval '1 year')::date
  ORDER BY grid.rid, grid.d;
$$;

GRANT EXECUTE ON FUNCTION public.get_caisse_tickets_daily_by_restaurant(uuid[],date,date) TO authenticated;