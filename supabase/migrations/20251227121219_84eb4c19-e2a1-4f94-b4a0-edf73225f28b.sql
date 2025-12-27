-- Drop and recreate with simpler, more efficient logic
DROP FUNCTION IF EXISTS public.get_order_counts_for_accuracy(uuid[], timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_order_counts_for_accuracy(
  p_restaurant_ids uuid[],
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS TABLE(
  restaurant_id uuid,
  total_orders bigint,
  weekday integer,
  weekday_orders bigint,
  hour integer,
  hourly_orders bigint
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH base_data AS (
    SELECT 
      oh.restaurant_id,
      EXTRACT(DOW FROM oh.order_datetime)::integer as weekday,
      EXTRACT(HOUR FROM oh.order_datetime)::integer as hour
    FROM public.order_history oh
    WHERE oh.restaurant_id = ANY(p_restaurant_ids)
      AND oh.order_datetime >= p_start_date
      AND oh.order_datetime < p_end_date
      AND oh.order_status = 'completed'
  ),
  totals AS (
    SELECT 
      bd.restaurant_id,
      COUNT(*)::bigint as total_orders
    FROM base_data bd
    GROUP BY bd.restaurant_id
  ),
  weekday_agg AS (
    SELECT 
      bd.restaurant_id,
      bd.weekday,
      COUNT(*)::bigint as weekday_orders
    FROM base_data bd
    GROUP BY bd.restaurant_id, bd.weekday
  ),
  hourly_agg AS (
    SELECT 
      bd.restaurant_id,
      bd.hour,
      COUNT(*)::bigint as hourly_orders
    FROM base_data bd
    GROUP BY bd.restaurant_id, bd.hour
  )
  SELECT 
    COALESCE(t.restaurant_id, w.restaurant_id, h.restaurant_id) as restaurant_id,
    COALESCE(t.total_orders, 0) as total_orders,
    w.weekday,
    COALESCE(w.weekday_orders, 0) as weekday_orders,
    h.hour,
    COALESCE(h.hourly_orders, 0) as hourly_orders
  FROM totals t
  FULL OUTER JOIN weekday_agg w ON t.restaurant_id = w.restaurant_id
  FULL OUTER JOIN hourly_agg h ON t.restaurant_id = h.restaurant_id;
END;
$$;