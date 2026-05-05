CREATE OR REPLACE FUNCTION public.pick_next_backfill_job(p_limit integer DEFAULT 1)
 RETURNS TABLE(job_id uuid, restaurant_id uuid, restaurant_name text, uber_store_id text, month_start date, month_end date, attempts integer, report_type text, vague integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      bj.id AS bj_id,
      bj.restaurant_id AS bj_restaurant_id,
      bj.restaurant_name AS bj_restaurant_name,
      bj.uber_store_id AS bj_uber_store_id,
      bj.month_start AS bj_month_start,
      bj.month_end AS bj_month_end,
      bj.attempts AS bj_attempts,
      bj.report_type AS bj_report_type,
      bj.vague AS bj_vague,
      ROW_NUMBER() OVER (PARTITION BY bj.restaurant_id ORDER BY bj.vague ASC, bj.month_start ASC) AS rn
    FROM backfill_jobs bj
    WHERE bj.status = 'pending'
  ),
  picked AS (
    SELECT r.bj_id
    FROM ranked r
    WHERE r.rn = 1
    ORDER BY r.bj_vague ASC, r.bj_month_start ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE backfill_jobs bj
  SET
    status = 'running',
    attempts = bj.attempts + 1,
    started_at = COALESCE(bj.started_at, now()),
    updated_at = now()
  FROM picked p
  WHERE bj.id = p.bj_id
  RETURNING
    bj.id,
    bj.restaurant_id,
    bj.restaurant_name,
    bj.uber_store_id,
    bj.month_start,
    bj.month_end,
    bj.attempts,
    bj.report_type,
    bj.vague;
END;
$function$;

-- Reset les jobs qui sont restés bloqués en "running" sans report_id à cause du bug
UPDATE backfill_jobs
SET status = 'pending', updated_at = now()
WHERE status = 'running' AND report_id IS NULL AND started_at < now() - interval '5 minutes';