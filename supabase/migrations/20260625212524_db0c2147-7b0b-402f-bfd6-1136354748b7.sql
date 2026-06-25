
-- 1. UBER LIVE
CREATE OR REPLACE FUNCTION public.get_live_uber_today(p_restaurant_ids uuid[], p_day date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH today AS (
  SELECT COALESCE(SUM(gross_amount_incl_vat),0)::numeric AS revenue, COUNT(*)::bigint AS orders
  FROM uber_live_orders
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND (order_placed_at AT TIME ZONE 'Europe/Paris')::date = p_day
    AND (status IS NULL OR upper(status) NOT IN ('CANCELLED','CANCELED','FAILED'))
),
yesterday AS (
  SELECT COALESCE(SUM(sales_incl_vat),0)::numeric AS revenue, COUNT(*)::bigint AS orders
  FROM orders
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND (order_datetime AT TIME ZONE 'Europe/Paris')::date = p_day - 1
),
hourly AS (
  SELECT EXTRACT(HOUR FROM (order_placed_at AT TIME ZONE 'Europe/Paris'))::int AS h,
         COALESCE(SUM(gross_amount_incl_vat),0)::numeric AS revenue,
         COUNT(*)::bigint AS orders
  FROM uber_live_orders
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND (order_placed_at AT TIME ZONE 'Europe/Paris')::date = p_day
    AND (status IS NULL OR upper(status) NOT IN ('CANCELLED','CANCELED','FAILED'))
  GROUP BY 1
),
last_event AS (
  SELECT MAX(last_event_at) AS ts FROM uber_live_orders WHERE restaurant_id = ANY(p_restaurant_ids)
)
SELECT jsonb_build_object(
  'revenue', (SELECT revenue FROM today),
  'orders', (SELECT orders FROM today),
  'yesterday_revenue', (SELECT revenue FROM yesterday),
  'yesterday_orders', (SELECT orders FROM yesterday),
  'hourly', COALESCE((SELECT jsonb_agg(jsonb_build_object('hour',h,'revenue',revenue,'orders',orders) ORDER BY h) FROM hourly), '[]'::jsonb),
  'last_event_at', (SELECT ts FROM last_event)
);
$$;

-- 2. DISHOP LIVE
CREATE OR REPLACE FUNCTION public.get_live_dishop_today(p_restaurant_ids uuid[], p_day date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH today AS (
  SELECT COALESCE(SUM(price_total),0)::numeric AS revenue, COUNT(*)::bigint AS orders
  FROM dishop_orders
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND (order_date AT TIME ZONE 'Europe/Paris')::date = p_day
    AND (status IS NULL OR upper(status) NOT IN ('CANCELLED','CANCELED','REFUNDED'))
),
yesterday AS (
  SELECT COALESCE(SUM(price_total),0)::numeric AS revenue, COUNT(*)::bigint AS orders
  FROM dishop_orders
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND (order_date AT TIME ZONE 'Europe/Paris')::date = p_day - 1
    AND (status IS NULL OR upper(status) NOT IN ('CANCELLED','CANCELED','REFUNDED'))
),
hourly AS (
  SELECT EXTRACT(HOUR FROM (order_date AT TIME ZONE 'Europe/Paris'))::int AS h,
         COALESCE(SUM(price_total),0)::numeric AS revenue,
         COUNT(*)::bigint AS orders
  FROM dishop_orders
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND (order_date AT TIME ZONE 'Europe/Paris')::date = p_day
    AND (status IS NULL OR upper(status) NOT IN ('CANCELLED','CANCELED','REFUNDED'))
  GROUP BY 1
),
last_event AS (
  SELECT MAX(updated_at) AS ts FROM dishop_orders WHERE restaurant_id = ANY(p_restaurant_ids)
)
SELECT jsonb_build_object(
  'revenue', (SELECT revenue FROM today),
  'orders', (SELECT orders FROM today),
  'yesterday_revenue', (SELECT revenue FROM yesterday),
  'yesterday_orders', (SELECT orders FROM yesterday),
  'hourly', COALESCE((SELECT jsonb_agg(jsonb_build_object('hour',h,'revenue',revenue,'orders',orders) ORDER BY h) FROM hourly), '[]'::jsonb),
  'last_event_at', (SELECT ts FROM last_event)
);
$$;

-- 3. SPLASH LIVE
CREATE OR REPLACE FUNCTION public.get_live_splash_today(p_restaurant_ids uuid[], p_day date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH today AS (
  SELECT COALESCE(SUM(revenue_ttc),0)::numeric AS revenue, COALESCE(SUM(order_count),0)::bigint AS orders
  FROM splash360_daily_sales
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND date = p_day
    AND granularity = 'day'
),
yesterday AS (
  SELECT COALESCE(SUM(revenue_ttc),0)::numeric AS revenue, COALESCE(SUM(order_count),0)::bigint AS orders
  FROM splash360_daily_sales
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND date = p_day - 1
    AND granularity = 'day'
),
last_event AS (
  SELECT MAX(updated_at) AS ts FROM splash360_daily_sales WHERE restaurant_id = ANY(p_restaurant_ids)
)
SELECT jsonb_build_object(
  'revenue', (SELECT revenue FROM today),
  'orders', (SELECT orders FROM today),
  'yesterday_revenue', (SELECT revenue FROM yesterday),
  'yesterday_orders', (SELECT orders FROM yesterday),
  'hourly', '[]'::jsonb,
  'last_event_at', (SELECT ts FROM last_event)
);
$$;

-- 4. TOP RESTAURANTS LIVE (multi-canal)
CREATE OR REPLACE FUNCTION public.get_live_top_restaurants(p_restaurant_ids uuid[], p_day date, p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH uber AS (
  SELECT restaurant_id,
         COALESCE(SUM(gross_amount_incl_vat),0)::numeric AS revenue,
         COUNT(*)::bigint AS orders
  FROM uber_live_orders
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND (order_placed_at AT TIME ZONE 'Europe/Paris')::date = p_day
    AND (status IS NULL OR upper(status) NOT IN ('CANCELLED','CANCELED','FAILED'))
  GROUP BY 1
),
dishop AS (
  SELECT restaurant_id,
         COALESCE(SUM(price_total),0)::numeric AS revenue,
         COUNT(*)::bigint AS orders
  FROM dishop_orders
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND (order_date AT TIME ZONE 'Europe/Paris')::date = p_day
    AND (status IS NULL OR upper(status) NOT IN ('CANCELLED','CANCELED','REFUNDED'))
  GROUP BY 1
),
splash AS (
  SELECT restaurant_id,
         COALESCE(SUM(revenue_ttc),0)::numeric AS revenue,
         COALESCE(SUM(order_count),0)::bigint AS orders
  FROM splash360_daily_sales
  WHERE restaurant_id = ANY(p_restaurant_ids)
    AND date = p_day
    AND granularity = 'day'
  GROUP BY 1
),
agg AS (
  SELECT r.id AS restaurant_id, r.name,
         COALESCE(u.revenue,0) AS uber_revenue,
         COALESCE(d.revenue,0) AS dishop_revenue,
         COALESCE(s.revenue,0) AS splash_revenue,
         COALESCE(u.orders,0) + COALESCE(d.orders,0) + COALESCE(s.orders,0) AS total_orders,
         COALESCE(u.revenue,0) + COALESCE(d.revenue,0) + COALESCE(s.revenue,0) AS total_revenue
  FROM restaurants r
  LEFT JOIN uber u ON u.restaurant_id = r.id
  LEFT JOIN dishop d ON d.restaurant_id = r.id
  LEFT JOIN splash s ON s.restaurant_id = r.id
  WHERE r.id = ANY(p_restaurant_ids)
)
SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'total_revenue')::numeric DESC), '[]'::jsonb)
FROM (
  SELECT jsonb_build_object(
    'restaurant_id', restaurant_id,
    'name', name,
    'uber_revenue', uber_revenue,
    'dishop_revenue', dishop_revenue,
    'splash_revenue', splash_revenue,
    'total_orders', total_orders,
    'total_revenue', total_revenue
  ) AS row
  FROM agg
  WHERE (uber_revenue + dishop_revenue + splash_revenue) > 0
  ORDER BY (uber_revenue + dishop_revenue + splash_revenue) DESC
  LIMIT p_limit
) sub;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_uber_today(uuid[], date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_live_dishop_today(uuid[], date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_live_splash_today(uuid[], date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_live_top_restaurants(uuid[], date, int) TO authenticated, service_role;
