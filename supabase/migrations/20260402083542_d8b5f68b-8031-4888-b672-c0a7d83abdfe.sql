CREATE OR REPLACE FUNCTION public.get_availability_by_restaurant(
  p_start_date date, p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(restaurant_id uuid, total_online_minutes numeric, total_offline_minutes numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.restaurant_id,
    COALESCE(SUM(h.online_minutes), 0)::numeric,
    COALESCE(SUM(h.offline_minutes), 0)::numeric
  FROM public.hourly_availability h
  WHERE h.hour_start >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND h.hour_start < ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY h.restaurant_id;
END;
$$;