-- Function to get hourly performance aggregated data
-- This avoids the 1000 row limit by aggregating in the database
CREATE OR REPLACE FUNCTION public.get_hourly_order_performance(
  p_restaurant_ids uuid[],
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS TABLE(
  restaurant_id uuid,
  hour integer,
  order_count bigint,
  revenue numeric
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
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
  GROUP BY oh.restaurant_id, EXTRACT(HOUR FROM oh.order_datetime)
  ORDER BY oh.restaurant_id, hour;
END;
$$;