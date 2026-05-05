-- 1. Picker diversifié : 1 job par restaurant max par tick
CREATE OR REPLACE FUNCTION public.pick_next_backfill_job(p_limit integer DEFAULT 1)
RETURNS TABLE(
  job_id uuid,
  restaurant_id uuid,
  restaurant_name text,
  uber_store_id text,
  month_start date,
  month_end date,
  attempts integer,
  report_type text,
  vague integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      bj.id,
      bj.restaurant_id,
      bj.restaurant_name,
      bj.uber_store_id,
      bj.month_start,
      bj.month_end,
      bj.attempts,
      bj.report_type,
      bj.vague,
      ROW_NUMBER() OVER (PARTITION BY bj.restaurant_id ORDER BY bj.vague ASC, bj.month_start ASC) AS rn
    FROM backfill_jobs bj
    WHERE bj.status = 'pending'
  ),
  picked AS (
    SELECT id
    FROM ranked
    WHERE rn = 1
    ORDER BY vague ASC, month_start ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE backfill_jobs bj
  SET
    status = 'running',
    attempts = bj.attempts + 1,
    started_at = COALESCE(bj.started_at, now()),
    updated_at = now()
  FROM picked
  WHERE bj.id = picked.id
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
$$;

-- 2. Reset des jobs failed à cause du rate-limit
UPDATE backfill_jobs
SET status = 'pending', attempts = 0, last_error = NULL, updated_at = now()
WHERE status = 'failed'
  AND (last_error ILIKE '%too_many_requests%' OR last_error ILIKE '%TooManyRequests%');