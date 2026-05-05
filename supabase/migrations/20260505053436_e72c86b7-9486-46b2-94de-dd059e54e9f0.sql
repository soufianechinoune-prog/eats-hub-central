CREATE OR REPLACE FUNCTION public.pick_next_backfill_job()
 RETURNS TABLE(job_id uuid, restaurant_id uuid, restaurant_name text, uber_store_id text, month_start date, month_end date, attempts integer, report_type text, vague integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_job_id uuid;
BEGIN
  UPDATE public.backfill_jobs bj
  SET status = 'running',
      started_at = now(),
      attempts = bj.attempts + 1,
      updated_at = now()
  WHERE bj.id = (
    SELECT b.id FROM public.backfill_jobs b
    WHERE b.status = 'pending'
    ORDER BY b.vague ASC, b.restaurant_name ASC, b.month_start ASC
    LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  RETURNING bj.id INTO v_job_id;

  IF v_job_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT j.id, j.restaurant_id, j.restaurant_name, j.uber_store_id,
         j.month_start, j.month_end, j.attempts, j.report_type, j.vague
  FROM public.backfill_jobs j WHERE j.id = v_job_id;
END;
$function$;