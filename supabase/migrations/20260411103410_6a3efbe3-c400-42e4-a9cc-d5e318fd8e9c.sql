
CREATE OR REPLACE FUNCTION public.get_prep_time_daily(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(
  restaurant_id uuid,
  day date,
  hour integer,
  avg_prep_time numeric,
  min_prep_time numeric,
  max_prep_time numeric,
  order_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  -- Daily aggregates (hour = NULL)
  SELECT
    oh.restaurant_id,
    (oh.order_datetime AT TIME ZONE 'Europe/Paris')::date AS day,
    NULL::integer AS hour,
    ROUND(AVG(oh.initial_prep_time_minutes)::numeric, 2) AS avg_prep_time,
    MIN(oh.initial_prep_time_minutes)::numeric AS min_prep_time,
    MAX(oh.initial_prep_time_minutes)::numeric AS max_prep_time,
    COUNT(*)::bigint AS order_count
  FROM public.order_history oh
  WHERE oh.restaurant_id = ANY(p_restaurant_ids)
    AND oh.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND oh.order_datetime < ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
    AND oh.initial_prep_time_minutes IS NOT NULL
    AND (p_platform IS NULL OR oh.platform = p_platform)
  GROUP BY oh.restaurant_id, (oh.order_datetime AT TIME ZONE 'Europe/Paris')::date

  UNION ALL

  -- Hourly aggregates (hour = 0-23)
  SELECT
    oh.restaurant_id,
    (oh.order_datetime AT TIME ZONE 'Europe/Paris')::date AS day,
    EXTRACT(HOUR FROM (oh.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS hour,
    ROUND(AVG(oh.initial_prep_time_minutes)::numeric, 2) AS avg_prep_time,
    MIN(oh.initial_prep_time_minutes)::numeric AS min_prep_time,
    MAX(oh.initial_prep_time_minutes)::numeric AS max_prep_time,
    COUNT(*)::bigint AS order_count
  FROM public.order_history oh
  WHERE oh.restaurant_id = ANY(p_restaurant_ids)
    AND oh.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND oh.order_datetime < ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
    AND oh.initial_prep_time_minutes IS NOT NULL
    AND (p_platform IS NULL OR oh.platform = p_platform)
  GROUP BY oh.restaurant_id, (oh.order_datetime AT TIME ZONE 'Europe/Paris')::date, EXTRACT(HOUR FROM (oh.order_datetime AT TIME ZONE 'Europe/Paris'))
  ORDER BY day, hour NULLS FIRST;
END;
$$;
