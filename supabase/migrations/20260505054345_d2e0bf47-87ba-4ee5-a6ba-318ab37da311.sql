
-- 1. Recréer pick_next_backfill_job avec un paramètre p_limit
DROP FUNCTION IF EXISTS public.pick_next_backfill_job();
DROP FUNCTION IF EXISTS public.pick_next_backfill_job(integer);

CREATE OR REPLACE FUNCTION public.pick_next_backfill_job(p_limit integer DEFAULT 1)
RETURNS TABLE(job_id uuid, restaurant_id uuid, restaurant_name text, uber_store_id text, month_start date, month_end date, attempts integer, report_type text, vague integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH picked AS (
    UPDATE public.backfill_jobs bj
    SET status = 'running',
        started_at = now(),
        attempts = bj.attempts + 1,
        updated_at = now()
    WHERE bj.id IN (
      SELECT b.id FROM public.backfill_jobs b
      WHERE b.status = 'pending'
      ORDER BY b.vague ASC, b.restaurant_name ASC, b.month_start ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING bj.id, bj.restaurant_id, bj.restaurant_name, bj.uber_store_id,
              bj.month_start, bj.month_end, bj.attempts, bj.report_type, bj.vague
  )
  SELECT p.id, p.restaurant_id, p.restaurant_name, p.uber_store_id,
         p.month_start, p.month_end, p.attempts, p.report_type, p.vague
  FROM picked p;
END;
$function$;

-- 2. Reset des jobs failed pour les retraiter avec la nouvelle logique de découpage
UPDATE public.backfill_jobs
SET status = 'pending',
    attempts = 0,
    last_error = NULL,
    started_at = NULL,
    updated_at = now()
WHERE status = 'failed';
