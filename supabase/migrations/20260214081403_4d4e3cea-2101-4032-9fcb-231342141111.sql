
-- Add composite index for faster uber_one queries
CREATE INDEX IF NOT EXISTS idx_order_history_restaurant_platform_date 
ON public.order_history (restaurant_id, platform, order_datetime);

-- Recreate get_uber_one_stats with optimized query (avoid expensive TZ conversion in GROUP BY)
CREATE OR REPLACE FUNCTION public.get_uber_one_stats(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_restaurant_ids uuid[],
  p_platform text DEFAULT NULL,
  p_granularity text DEFAULT 'monthly'
)
RETURNS TABLE(
  period_key text,
  restaurant_id uuid,
  uber_one_count bigint,
  non_uber_one_count bigint,
  uber_one_revenue numeric,
  non_uber_one_revenue numeric,
  uber_one_prep_sum numeric,
  non_uber_one_prep_sum numeric,
  uber_one_prep_count bigint,
  non_uber_one_prep_count bigint
)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN p_granularity = 'daily' THEN to_char(oh.order_datetime::date, 'YYYY-MM-DD')
      ELSE to_char(oh.order_datetime::date, 'YYYY-MM')
    END as period_key,
    oh.restaurant_id,
    COUNT(*) FILTER (WHERE oh.uber_one = true)::bigint as uber_one_count,
    COUNT(*) FILTER (WHERE oh.uber_one IS NOT true)::bigint as non_uber_one_count,
    COALESCE(SUM(oh.order_amount) FILTER (WHERE oh.uber_one = true), 0)::numeric as uber_one_revenue,
    COALESCE(SUM(oh.order_amount) FILTER (WHERE oh.uber_one IS NOT true), 0)::numeric as non_uber_one_revenue,
    COALESCE(SUM(oh.initial_prep_time_minutes) FILTER (WHERE oh.uber_one = true AND oh.initial_prep_time_minutes IS NOT NULL), 0)::numeric as uber_one_prep_sum,
    COALESCE(SUM(oh.initial_prep_time_minutes) FILTER (WHERE oh.uber_one IS NOT true AND oh.initial_prep_time_minutes IS NOT NULL), 0)::numeric as non_uber_one_prep_sum,
    COUNT(*) FILTER (WHERE oh.uber_one = true AND oh.initial_prep_time_minutes IS NOT NULL)::bigint as uber_one_prep_count,
    COUNT(*) FILTER (WHERE oh.uber_one IS NOT true AND oh.initial_prep_time_minutes IS NOT NULL)::bigint as non_uber_one_prep_count
  FROM public.order_history oh
  WHERE oh.restaurant_id = ANY(p_restaurant_ids)
    AND oh.order_datetime >= p_start_date
    AND oh.order_datetime <= p_end_date
    AND (p_platform IS NULL OR oh.platform = p_platform)
  GROUP BY 
    CASE 
      WHEN p_granularity = 'daily' THEN to_char(oh.order_datetime::date, 'YYYY-MM-DD')
      ELSE to_char(oh.order_datetime::date, 'YYYY-MM')
    END,
    oh.restaurant_id
  ORDER BY period_key, oh.restaurant_id;
END;
$$;
