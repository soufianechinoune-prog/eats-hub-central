CREATE OR REPLACE FUNCTION public.get_caisse_avg_basket_daily(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(date date, revenue numeric, tickets bigint, prev_revenue numeric, prev_tickets bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '30s'
AS $$
  WITH s AS (
    SELECT d.date, SUM(COALESCE(d.revenue_ttc,0)) rev, SUM(COALESCE(d.order_count,0)) o
    FROM splash360_daily_sales d
    WHERE d.granularity='day' AND d.platform='global' AND d.restaurant_splash_id<>0
      AND d.restaurant_id = ANY(p_restaurant_ids)
      AND public.user_has_chain_access(d.chain_id)
      AND (d.date BETWEEN p_start AND p_end OR d.date BETWEEN (p_start - interval '1 year')::date AND (p_end - interval '1 year')::date)
    GROUP BY d.date
  ), c AS (
    SELECT a.date, SUM(COALESCE(a.gross_order_value,0)) rev, SUM(COALESCE(a.order_count,0)) o
    FROM chataigne_daily_analytics a
    WHERE a.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(a.chain_id)
      AND (a.date BETWEEN p_start AND p_end OR a.date BETWEEN (p_start - interval '1 year')::date AND (p_end - interval '1 year')::date)
    GROUP BY a.date
  ), n AS (
    SELECT s.date, GREATEST(s.rev - COALESCE(c.rev,0),0) rev, GREATEST(s.o - COALESCE(c.o,0),0)::bigint o
    FROM s LEFT JOIN c ON c.date=s.date
  ), days AS (SELECT generate_series(p_start, p_end, interval '1 day')::date d)
  SELECT days.d, COALESCE(cur.rev,0), COALESCE(cur.o,0), COALESCE(pr.rev,0), COALESCE(pr.o,0)
  FROM days LEFT JOIN n cur ON cur.date=days.d
  LEFT JOIN n pr ON pr.date=(days.d - interval '1 year')::date
  ORDER BY days.d;
$$;

CREATE OR REPLACE FUNCTION public.get_caisse_avg_basket_by_restaurant(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(restaurant_id uuid, restaurant_name text, revenue numeric, tickets bigint, prev_revenue numeric, prev_tickets bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '30s'
AS $$
  WITH s AS (
    SELECT d.restaurant_id,
      SUM(d.revenue_ttc) FILTER (WHERE d.date BETWEEN p_start AND p_end) cr,
      SUM(d.order_count) FILTER (WHERE d.date BETWEEN p_start AND p_end) co,
      SUM(d.revenue_ttc) FILTER (WHERE d.date < p_start) pr,
      SUM(d.order_count) FILTER (WHERE d.date < p_start) po
    FROM splash360_daily_sales d
    WHERE d.granularity='day' AND d.platform='global' AND d.restaurant_splash_id<>0
      AND d.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(d.chain_id)
      AND (d.date BETWEEN p_start AND p_end OR d.date BETWEEN (p_start - interval '1 year')::date AND (p_end - interval '1 year')::date)
    GROUP BY d.restaurant_id
  ), c AS (
    SELECT a.restaurant_id,
      SUM(a.gross_order_value) FILTER (WHERE a.date BETWEEN p_start AND p_end) cr,
      SUM(a.order_count) FILTER (WHERE a.date BETWEEN p_start AND p_end) co,
      SUM(a.gross_order_value) FILTER (WHERE a.date < p_start) pr,
      SUM(a.order_count) FILTER (WHERE a.date < p_start) po
    FROM chataigne_daily_analytics a
    WHERE a.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(a.chain_id)
      AND (a.date BETWEEN p_start AND p_end OR a.date BETWEEN (p_start - interval '1 year')::date AND (p_end - interval '1 year')::date)
    GROUP BY a.restaurant_id
  )
  SELECT s.restaurant_id, r.name,
    GREATEST(COALESCE(s.cr,0)-COALESCE(c.cr,0),0),
    GREATEST(COALESCE(s.co,0)-COALESCE(c.co,0),0)::bigint,
    GREATEST(COALESCE(s.pr,0)-COALESCE(c.pr,0),0),
    GREATEST(COALESCE(s.po,0)-COALESCE(c.po,0),0)::bigint
  FROM s JOIN restaurants r ON r.id=s.restaurant_id
  LEFT JOIN c ON c.restaurant_id=s.restaurant_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_caisse_avg_basket_daily(uuid[],date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_caisse_avg_basket_by_restaurant(uuid[],date,date) TO authenticated;