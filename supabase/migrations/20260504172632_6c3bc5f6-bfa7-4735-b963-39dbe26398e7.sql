CREATE OR REPLACE FUNCTION public.pick_next_backfill_job()
RETURNS TABLE(
  job_id UUID,
  restaurant_id UUID,
  restaurant_name TEXT,
  uber_store_id TEXT,
  month_start DATE,
  month_end DATE,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next_job AS (
    SELECT bj.id
    FROM backfill_jobs bj
    WHERE bj.status = 'pending'
    ORDER BY bj.restaurant_name ASC, bj.month_start ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE backfill_jobs bj
  SET status = 'running',
      started_at = now(),
      attempts = bj.attempts + 1,
      updated_at = now()
  FROM next_job nj
  WHERE bj.id = nj.id
  RETURNING bj.id AS job_id, bj.restaurant_id, bj.restaurant_name, bj.uber_store_id,
           bj.month_start, bj.month_end, bj.attempts;
END;
$$;