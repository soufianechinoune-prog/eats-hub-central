CREATE OR REPLACE FUNCTION public.requeue_recent_splash_tickets()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d date := (now() AT TIME ZONE 'Europe/Paris')::date - 1; n integer;
BEGIN
  INSERT INTO splash_ticket_backfill_jobs (restaurant_id, chain_id, station, year, month, status, priority, page_cursor, attempts, next_attempt_at)
  SELECT c.restaurant_id, c.chain_id, c.station, extract(year from m)::int, extract(month from m)::int, 'pending', 10, 0, 0, now()
  FROM splash_restaurant_credentials c
  CROSS JOIN (SELECT DISTINCT date_trunc('month', x)::date m FROM (VALUES (d), (d - 15)) v(x)) mm
  WHERE c.is_active AND c.restaurant_id IS NOT NULL
  ON CONFLICT (restaurant_id, station, year, month) DO UPDATE
    SET status = 'pending', priority = 10, page_cursor = 0, attempts = 0, last_error = NULL,
        completed_at = NULL, next_attempt_at = now(), locked_until = NULL, updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;