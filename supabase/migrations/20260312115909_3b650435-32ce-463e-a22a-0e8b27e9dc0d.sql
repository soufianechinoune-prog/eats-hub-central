
CREATE OR REPLACE FUNCTION public.get_active_hours_summary(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_platform text DEFAULT NULL
)
RETURNS TABLE (
  restaurant_id uuid,
  distinct_active_hours bigint,
  active_weeks bigint,
  avg_hours_per_week numeric,
  total_revenue numeric,
  total_orders bigint,
  has_uber boolean,
  has_deliveroo boolean
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH uber_hours AS (
    SELECT 
      o.restaurant_id,
      COUNT(DISTINCT date_trunc('hour', o.order_datetime))::bigint as distinct_hours,
      COUNT(DISTINCT date_trunc('week', o.order_datetime))::bigint as weeks,
      COALESCE(SUM(o.sales_incl_vat), 0)::numeric as revenue,
      COUNT(*)::bigint as orders
    FROM public.orders o
    WHERE o.restaurant_id = ANY(p_restaurant_ids)
      AND o.order_datetime >= p_start_date::timestamp
      AND o.order_datetime < (p_end_date + interval '1 day')::timestamp
      AND (p_platform IS NULL OR p_platform = 'global' OR p_platform = 'uber_eats')
    GROUP BY o.restaurant_id
  ),
  deliveroo_hours AS (
    SELECT 
      d.restaurant_id,
      COUNT(DISTINCT date_trunc('hour', d.delivery_datetime))::bigint as distinct_hours,
      COUNT(DISTINCT date_trunc('week', d.delivery_datetime))::bigint as weeks,
      COALESCE(SUM(d.order_amount), 0)::numeric as revenue,
      COUNT(*)::bigint as orders
    FROM public.deliveroo_orders d
    WHERE d.restaurant_id = ANY(p_restaurant_ids)
      AND d.delivery_datetime >= p_start_date::timestamp
      AND d.delivery_datetime < (p_end_date + interval '1 day')::timestamp
      AND d.history_type IN ('Livraison', 'À emporter', 'Nouvelle livraison')
      AND (p_platform IS NULL OR p_platform = 'global' OR p_platform = 'deliveroo')
    GROUP BY d.restaurant_id
  ),
  combined AS (
    SELECT
      COALESCE(uh.restaurant_id, dh.restaurant_id) as restaurant_id,
      COALESCE(uh.distinct_hours, 0) + COALESCE(dh.distinct_hours, 0) as distinct_hours,
      GREATEST(COALESCE(uh.weeks, 0), COALESCE(dh.weeks, 0)) as weeks,
      COALESCE(uh.revenue, 0) + COALESCE(dh.revenue, 0) as revenue,
      COALESCE(uh.orders, 0) + COALESCE(dh.orders, 0) as orders,
      uh.restaurant_id IS NOT NULL as has_uber,
      dh.restaurant_id IS NOT NULL as has_deliveroo
    FROM uber_hours uh
    FULL OUTER JOIN deliveroo_hours dh ON uh.restaurant_id = dh.restaurant_id
  )
  SELECT 
    c.restaurant_id,
    c.distinct_hours as distinct_active_hours,
    c.weeks as active_weeks,
    ROUND(c.distinct_hours::numeric / NULLIF(c.weeks, 0), 1) as avg_hours_per_week,
    c.revenue as total_revenue,
    c.orders as total_orders,
    c.has_uber,
    c.has_deliveroo
  FROM combined c;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_hourly_order_performance(
  p_restaurant_ids uuid[],
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(restaurant_id uuid, hour integer, order_count bigint, revenue numeric)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH uber_data AS (
    SELECT 
      oh.restaurant_id,
      EXTRACT(HOUR FROM oh.order_datetime)::integer as hour,
      COUNT(*)::bigint as order_count,
      COALESCE(SUM(oh.order_amount), 0)::numeric as revenue
    FROM public.order_history oh
    WHERE oh.restaurant_id = ANY(p_restaurant_ids)
      AND oh.order_datetime >= p_start_date
      AND oh.order_datetime <= p_end_date
      AND oh.order_status = 'completed'
      AND (p_platform IS NULL OR p_platform = 'global' OR p_platform = 'uber_eats')
    GROUP BY oh.restaurant_id, EXTRACT(HOUR FROM oh.order_datetime)
  ),
  deliveroo_data AS (
    SELECT 
      d.restaurant_id,
      EXTRACT(HOUR FROM d.delivery_datetime)::integer as hour,
      COUNT(*)::bigint as order_count,
      COALESCE(SUM(d.order_amount), 0)::numeric as revenue
    FROM public.deliveroo_orders d
    WHERE d.restaurant_id = ANY(p_restaurant_ids)
      AND d.delivery_datetime >= p_start_date
      AND d.delivery_datetime <= p_end_date
      AND d.history_type IN ('Livraison', 'À emporter', 'Nouvelle livraison')
      AND (p_platform IS NULL OR p_platform = 'global' OR p_platform = 'deliveroo')
    GROUP BY d.restaurant_id, EXTRACT(HOUR FROM d.delivery_datetime)
  )
  SELECT
    COALESCE(u.restaurant_id, d.restaurant_id) as restaurant_id,
    COALESCE(u.hour, d.hour) as hour,
    (COALESCE(u.order_count, 0) + COALESCE(d.order_count, 0))::bigint as order_count,
    (COALESCE(u.revenue, 0) + COALESCE(d.revenue, 0))::numeric as revenue
  FROM uber_data u
  FULL OUTER JOIN deliveroo_data d ON u.restaurant_id = d.restaurant_id AND u.hour = d.hour
  ORDER BY restaurant_id, hour;
END;
$$;
