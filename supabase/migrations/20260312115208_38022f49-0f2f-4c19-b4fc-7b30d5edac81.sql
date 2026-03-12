
CREATE OR REPLACE FUNCTION public.get_active_hours_summary(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
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
    GROUP BY o.restaurant_id
  ),
  deliveroo_check AS (
    SELECT DISTINCT d.restaurant_id
    FROM public.deliveroo_orders d
    WHERE d.restaurant_id = ANY(p_restaurant_ids)
      AND d.delivery_datetime >= p_start_date::timestamp
      AND d.delivery_datetime < (p_end_date + interval '1 day')::timestamp
      AND d.history_type IN ('Livraison', 'À emporter', 'Nouvelle livraison')
  )
  SELECT 
    uh.restaurant_id,
    uh.distinct_hours as distinct_active_hours,
    uh.weeks as active_weeks,
    ROUND(uh.distinct_hours::numeric / NULLIF(uh.weeks, 0), 1) as avg_hours_per_week,
    uh.revenue as total_revenue,
    uh.orders as total_orders,
    true as has_uber,
    EXISTS(SELECT 1 FROM deliveroo_check dc WHERE dc.restaurant_id = uh.restaurant_id) as has_deliveroo
  FROM uber_hours uh;
END;
$$;
