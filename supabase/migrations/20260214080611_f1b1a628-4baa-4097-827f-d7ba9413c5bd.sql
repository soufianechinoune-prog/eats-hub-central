
-- 1. Monthly availability aggregation (year view)
CREATE OR REPLACE FUNCTION public.get_availability_monthly(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(
  month integer,
  total_online_minutes numeric,
  total_offline_minutes numeric
)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM h.hour_start)::integer as month,
    COALESCE(SUM(h.online_minutes), 0)::numeric as total_online_minutes,
    COALESCE(SUM(h.offline_minutes), 0)::numeric as total_offline_minutes
  FROM public.hourly_availability h
  WHERE EXTRACT(YEAR FROM h.hour_start) = p_year
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY EXTRACT(MONTH FROM h.hour_start)
  ORDER BY month;
END;
$$;

-- 2. Daily availability aggregation (month/range view)
CREATE OR REPLACE FUNCTION public.get_availability_daily(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(
  day date,
  total_online_minutes numeric,
  total_offline_minutes numeric
)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (h.hour_start AT TIME ZONE 'Europe/Paris')::date as day,
    COALESCE(SUM(h.online_minutes), 0)::numeric as total_online_minutes,
    COALESCE(SUM(h.offline_minutes), 0)::numeric as total_offline_minutes
  FROM public.hourly_availability h
  WHERE h.hour_start >= p_start_date::timestamp
    AND h.hour_start < (p_end_date + interval '1 day')::timestamp
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY (h.hour_start AT TIME ZONE 'Europe/Paris')::date
  ORDER BY day;
END;
$$;

-- 3. Availability by restaurant (ranking)
CREATE OR REPLACE FUNCTION public.get_availability_by_restaurant(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(
  restaurant_id uuid,
  total_online_minutes numeric,
  total_offline_minutes numeric
)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.restaurant_id,
    COALESCE(SUM(h.online_minutes), 0)::numeric as total_online_minutes,
    COALESCE(SUM(h.offline_minutes), 0)::numeric as total_offline_minutes
  FROM public.hourly_availability h
  WHERE h.hour_start >= p_start_date::timestamp
    AND h.hour_start < (p_end_date + interval '1 day')::timestamp
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY h.restaurant_id;
END;
$$;

-- 4. Heatmap (day of week x hour)
CREATE OR REPLACE FUNCTION public.get_availability_heatmap(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(
  day_of_week integer,
  hour integer,
  avg_offline_minutes numeric,
  record_count bigint
)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(DOW FROM h.hour_start)::integer as day_of_week,
    EXTRACT(HOUR FROM h.hour_start)::integer as hour,
    ROUND(AVG(h.offline_minutes)::numeric, 2) as avg_offline_minutes,
    COUNT(*) as record_count
  FROM public.hourly_availability h
  WHERE h.hour_start >= p_start_date::timestamp
    AND h.hour_start < (p_end_date + interval '1 day')::timestamp
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY EXTRACT(DOW FROM h.hour_start), EXTRACT(HOUR FROM h.hour_start)
  ORDER BY day_of_week, hour;
END;
$$;

-- 5. Uber One stats aggregation
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
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN p_granularity = 'daily' THEN to_char((oh.order_datetime AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD')
      ELSE to_char((oh.order_datetime AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM')
    END as period_key,
    oh.restaurant_id,
    COUNT(*) FILTER (WHERE oh.uber_one = true)::bigint as uber_one_count,
    COUNT(*) FILTER (WHERE oh.uber_one = false OR oh.uber_one IS NULL)::bigint as non_uber_one_count,
    COALESCE(SUM(oh.order_amount) FILTER (WHERE oh.uber_one = true), 0)::numeric as uber_one_revenue,
    COALESCE(SUM(oh.order_amount) FILTER (WHERE oh.uber_one = false OR oh.uber_one IS NULL), 0)::numeric as non_uber_one_revenue,
    COALESCE(SUM(oh.initial_prep_time_minutes) FILTER (WHERE oh.uber_one = true AND oh.initial_prep_time_minutes IS NOT NULL), 0)::numeric as uber_one_prep_sum,
    COALESCE(SUM(oh.initial_prep_time_minutes) FILTER (WHERE (oh.uber_one = false OR oh.uber_one IS NULL) AND oh.initial_prep_time_minutes IS NOT NULL), 0)::numeric as non_uber_one_prep_sum,
    COUNT(*) FILTER (WHERE oh.uber_one = true AND oh.initial_prep_time_minutes IS NOT NULL)::bigint as uber_one_prep_count,
    COUNT(*) FILTER (WHERE (oh.uber_one = false OR oh.uber_one IS NULL) AND oh.initial_prep_time_minutes IS NOT NULL)::bigint as non_uber_one_prep_count
  FROM public.order_history oh
  WHERE oh.restaurant_id = ANY(p_restaurant_ids)
    AND oh.order_datetime >= p_start_date
    AND oh.order_datetime <= p_end_date
    AND (p_platform IS NULL OR oh.platform = p_platform)
  GROUP BY 
    CASE 
      WHEN p_granularity = 'daily' THEN to_char((oh.order_datetime AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD')
      ELSE to_char((oh.order_datetime AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM')
    END,
    oh.restaurant_id
  ORDER BY period_key, oh.restaurant_id;
END;
$$;
