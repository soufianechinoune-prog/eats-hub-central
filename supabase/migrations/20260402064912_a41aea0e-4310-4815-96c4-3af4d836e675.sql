
-- 1. Optimize get_product_sales_for_period: add p_end_date param, LIMIT 50, timeout 10s
CREATE OR REPLACE FUNCTION public.get_product_sales_for_period(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(item_title text, total_quantity bigint)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  SELECT oi.item_title, SUM(oi.quantity)::BIGINT as total_quantity
  FROM public.order_items oi
  JOIN public.orders o ON oi.order_id = o.id
  WHERE (p_start_date IS NULL OR o.order_datetime >= p_start_date)
    AND (p_end_date IS NULL OR o.order_datetime <= p_end_date)
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY oi.item_title
  ORDER BY total_quantity DESC
  LIMIT 50;
END;
$$;

-- 2. Add statement_timeout on get_availability_by_restaurant
CREATE OR REPLACE FUNCTION public.get_availability_by_restaurant(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(restaurant_id uuid, total_online_minutes numeric, total_offline_minutes numeric)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.restaurant_id,
    COALESCE(SUM(h.online_minutes), 0)::numeric as total_online_minutes,
    COALESCE(SUM(h.offline_minutes), 0)::numeric as total_offline_minutes
  FROM public.hourly_availability h
  WHERE (h.hour_start AT TIME ZONE 'Europe/Paris')::date >= p_start_date
    AND (h.hour_start AT TIME ZONE 'Europe/Paris')::date <= p_end_date
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY h.restaurant_id;
END;
$$;

-- 3. Reduce timeout on get_network_prep_time_summary from 30s to 10s
CREATE OR REPLACE FUNCTION public.get_network_prep_time_summary(
  p_restaurant_ids uuid[],
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE(restaurant_id uuid, avg_prep_time numeric, avg_total_delivery_time numeric, avg_avoidable_wait_time numeric, prep_count bigint, delivery_count bigint, avoidable_wait_count bigint)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oh.restaurant_id,
    ROUND(AVG(oh.initial_prep_time_minutes) FILTER (WHERE oh.initial_prep_time_minutes IS NOT NULL), 2) AS avg_prep_time,
    ROUND(AVG(oh.total_prep_delivery_time_minutes) FILTER (WHERE oh.total_prep_delivery_time_minutes IS NOT NULL), 2) AS avg_total_delivery_time,
    ROUND(AVG(oh.avoidable_wait_time_minutes) FILTER (WHERE oh.avoidable_wait_time_minutes IS NOT NULL), 2) AS avg_avoidable_wait_time,
    COUNT(*) FILTER (WHERE oh.initial_prep_time_minutes IS NOT NULL)::bigint AS prep_count,
    COUNT(*) FILTER (WHERE oh.total_prep_delivery_time_minutes IS NOT NULL)::bigint AS delivery_count,
    COUNT(*) FILTER (WHERE oh.avoidable_wait_time_minutes IS NOT NULL)::bigint AS avoidable_wait_count
  FROM public.order_history oh
  WHERE oh.restaurant_id = ANY(p_restaurant_ids)
    AND oh.order_datetime >= p_start_date
    AND oh.order_datetime <= p_end_date
  GROUP BY oh.restaurant_id;
END;
$$;
