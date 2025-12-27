-- Create RPC function to get order counts by restaurant with weekday/hour breakdown
-- This avoids the 1000 row limit by aggregating server-side
CREATE OR REPLACE FUNCTION public.get_order_counts_for_accuracy(
  p_restaurant_ids uuid[],
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS TABLE(
  restaurant_id uuid,
  total_orders bigint,
  weekday_counts jsonb,
  hourly_counts jsonb
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oh.restaurant_id,
    COUNT(*)::bigint as total_orders,
    jsonb_object_agg(
      EXTRACT(DOW FROM oh.order_datetime)::text,
      weekday_data.count
    ) FILTER (WHERE weekday_data.count IS NOT NULL) as weekday_counts,
    jsonb_object_agg(
      hourly_data.hour::text,
      hourly_data.count
    ) FILTER (WHERE hourly_data.count IS NOT NULL) as hourly_counts
  FROM public.order_history oh
  LEFT JOIN LATERAL (
    SELECT 
      EXTRACT(DOW FROM oh2.order_datetime)::int as dow,
      COUNT(*)::bigint as count
    FROM public.order_history oh2
    WHERE oh2.restaurant_id = oh.restaurant_id
      AND oh2.order_datetime >= p_start_date
      AND oh2.order_datetime < p_end_date
      AND oh2.order_status = 'completed'
    GROUP BY EXTRACT(DOW FROM oh2.order_datetime)
  ) weekday_data ON true
  LEFT JOIN LATERAL (
    SELECT 
      EXTRACT(HOUR FROM oh3.order_datetime)::int as hour,
      COUNT(*)::bigint as count
    FROM public.order_history oh3
    WHERE oh3.restaurant_id = oh.restaurant_id
      AND oh3.order_datetime >= p_start_date
      AND oh3.order_datetime < p_end_date
      AND oh3.order_status = 'completed'
    GROUP BY EXTRACT(HOUR FROM oh3.order_datetime)
  ) hourly_data ON true
  WHERE oh.restaurant_id = ANY(p_restaurant_ids)
    AND oh.order_datetime >= p_start_date
    AND oh.order_datetime < p_end_date
    AND oh.order_status = 'completed'
  GROUP BY oh.restaurant_id;
END;
$$;