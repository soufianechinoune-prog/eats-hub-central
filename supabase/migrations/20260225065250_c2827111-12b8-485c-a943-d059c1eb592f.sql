
-- Fix timezone mismatch in availability RPC functions
-- Align WHERE clause filtering with GROUP BY timezone (Europe/Paris)

CREATE OR REPLACE FUNCTION public.get_availability_daily(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[], p_platform text DEFAULT NULL::text)
 RETURNS TABLE(day date, total_online_minutes numeric, total_offline_minutes numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (h.hour_start AT TIME ZONE 'Europe/Paris')::date as day,
    COALESCE(SUM(h.online_minutes), 0)::numeric as total_online_minutes,
    COALESCE(SUM(h.offline_minutes), 0)::numeric as total_offline_minutes
  FROM public.hourly_availability h
  WHERE (h.hour_start AT TIME ZONE 'Europe/Paris')::date >= p_start_date
    AND (h.hour_start AT TIME ZONE 'Europe/Paris')::date <= p_end_date
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY (h.hour_start AT TIME ZONE 'Europe/Paris')::date
  ORDER BY day;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_availability_by_restaurant(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[], p_platform text DEFAULT NULL::text)
 RETURNS TABLE(restaurant_id uuid, total_online_minutes numeric, total_offline_minutes numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_availability_heatmap(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[], p_platform text DEFAULT NULL::text)
 RETURNS TABLE(day_of_week integer, hour integer, avg_offline_minutes numeric, record_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(DOW FROM (h.hour_start AT TIME ZONE 'Europe/Paris'))::integer as day_of_week,
    EXTRACT(HOUR FROM (h.hour_start AT TIME ZONE 'Europe/Paris'))::integer as hour,
    ROUND(AVG(h.offline_minutes)::numeric, 2) as avg_offline_minutes,
    COUNT(*) as record_count
  FROM public.hourly_availability h
  WHERE (h.hour_start AT TIME ZONE 'Europe/Paris')::date >= p_start_date
    AND (h.hour_start AT TIME ZONE 'Europe/Paris')::date <= p_end_date
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY EXTRACT(DOW FROM (h.hour_start AT TIME ZONE 'Europe/Paris')), EXTRACT(HOUR FROM (h.hour_start AT TIME ZONE 'Europe/Paris'))
  ORDER BY day_of_week, hour;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_availability_monthly(p_year integer, p_restaurant_ids uuid[] DEFAULT NULL::uuid[], p_platform text DEFAULT NULL::text)
 RETURNS TABLE(month integer, total_online_minutes numeric, total_offline_minutes numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM (h.hour_start AT TIME ZONE 'Europe/Paris'))::integer as month,
    COALESCE(SUM(h.online_minutes), 0)::numeric as total_online_minutes,
    COALESCE(SUM(h.offline_minutes), 0)::numeric as total_offline_minutes
  FROM public.hourly_availability h
  WHERE EXTRACT(YEAR FROM (h.hour_start AT TIME ZONE 'Europe/Paris')) = p_year
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY EXTRACT(MONTH FROM (h.hour_start AT TIME ZONE 'Europe/Paris'))
  ORDER BY month;
END;
$function$;
