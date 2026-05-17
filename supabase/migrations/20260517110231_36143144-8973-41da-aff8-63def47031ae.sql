CREATE OR REPLACE FUNCTION public.get_downtime_comparison(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accessible uuid[];
  v_result jsonb;
BEGIN
  IF p_restaurant_ids IS NULL OR array_length(p_restaurant_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Filter to restaurants the caller can access (multi-tenant safety)
  SELECT COALESCE(array_agg(r.id), '{}')
    INTO v_accessible
  FROM public.restaurants r
  WHERE r.id = ANY(p_restaurant_ids)
    AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id));

  IF v_accessible IS NULL OR array_length(v_accessible, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH base AS (
    SELECT
      ha.restaurant_id,
      (ha.hour_start AT TIME ZONE 'Europe/Paris')::date AS day,
      EXTRACT(HOUR FROM (ha.hour_start AT TIME ZONE 'Europe/Paris'))::int AS hour,
      EXTRACT(DOW  FROM (ha.hour_start AT TIME ZONE 'Europe/Paris'))::int AS weekday,
      COALESCE(ha.online_minutes, 0)  AS online_minutes,
      COALESCE(ha.offline_minutes, 0) AS offline_minutes
    FROM public.hourly_availability ha
    WHERE ha.restaurant_id = ANY(v_accessible)
      AND ha.platform = 'uber_eats'
      AND ha.hour_start >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
      AND ha.hour_start <  ((p_end_date + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  ),
  per_day AS (
    SELECT
      restaurant_id, day,
      SUM(online_minutes)::int  AS online,
      SUM(offline_minutes)::int AS offline
    FROM base
    GROUP BY restaurant_id, day
  ),
  per_hour_day AS (
    SELECT
      restaurant_id, day, hour,
      SUM(online_minutes)::int  AS online,
      SUM(offline_minutes)::int AS offline
    FROM base
    GROUP BY restaurant_id, day, hour
  ),
  per_hour AS (
    SELECT restaurant_id, hour, SUM(offline_minutes)::int AS offline
    FROM base GROUP BY restaurant_id, hour
  ),
  per_weekday AS (
    SELECT restaurant_id, weekday, SUM(offline_minutes)::int AS offline
    FROM base GROUP BY restaurant_id, weekday
  ),
  totals AS (
    SELECT
      restaurant_id,
      SUM(online)  AS total_online,
      SUM(offline) AS total_offline,
      AVG(CASE WHEN (online + offline) > 0
               THEN (online::numeric / (online + offline)) * 100
               ELSE 100 END) AS availability_rate
    FROM per_day
    GROUP BY restaurant_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'restaurant_id',         r.id,
    'total_online_minutes',  COALESCE(t.total_online, 0),
    'total_offline_minutes', COALESCE(t.total_offline, 0),
    'availability_rate',     COALESCE(t.availability_rate, 100),
    'daily', COALESCE((
      SELECT jsonb_object_agg(
        to_char(pd.day, 'YYYY-MM-DD'),
        jsonb_build_object(
          'online',  pd.online,
          'offline', pd.offline,
          'rate', CASE WHEN (pd.online + pd.offline) > 0
                       THEN (pd.online::numeric / (pd.online + pd.offline)) * 100
                       ELSE 100 END
        )
      ) FROM per_day pd WHERE pd.restaurant_id = r.id
    ), '{}'::jsonb),
    'hourly_by_day', COALESCE((
      SELECT jsonb_object_agg(day_key, hours_obj)
      FROM (
        SELECT to_char(phd.day, 'YYYY-MM-DD') AS day_key,
               jsonb_object_agg(
                 phd.hour::text,
                 jsonb_build_object(
                   'online',  phd.online,
                   'offline', phd.offline,
                   'rate', CASE WHEN (phd.online + phd.offline) > 0
                                THEN (phd.online::numeric / (phd.online + phd.offline)) * 100
                                ELSE 100 END
                 )
               ) AS hours_obj
        FROM per_hour_day phd
        WHERE phd.restaurant_id = r.id
        GROUP BY phd.day
      ) sub
    ), '{}'::jsonb),
    'hourly', COALESCE((
      SELECT jsonb_object_agg(ph.hour::text, ph.offline)
      FROM per_hour ph WHERE ph.restaurant_id = r.id
    ), '{}'::jsonb),
    'weekday', COALESCE((
      SELECT jsonb_object_agg(pw.weekday::text, pw.offline)
      FROM per_weekday pw WHERE pw.restaurant_id = r.id
    ), '{}'::jsonb)
  )), '[]'::jsonb)
  INTO v_result
  FROM unnest(v_accessible) AS rid(id)
  JOIN public.restaurants r ON r.id = rid.id
  LEFT JOIN totals t ON t.restaurant_id = r.id;

  RETURN v_result;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_hourly_availability_restaurant_platform_hour
  ON public.hourly_availability (restaurant_id, platform, hour_start);
