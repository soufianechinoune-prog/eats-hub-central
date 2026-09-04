DROP FUNCTION IF EXISTS public.get_payout_backfill_queue_status();
CREATE FUNCTION public.get_payout_backfill_queue_status()
 RETURNS TABLE(pending_jobs bigint, running_jobs bigint, retro_jobs bigint, throttled_jobs bigint, throttle_failed_jobs bigint, oldest_window date, newest_window date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    count(*) FILTER (WHERE status = 'pending')::bigint,
    count(*) FILTER (WHERE status = 'running')::bigint,
    count(*) FILTER (WHERE status IN ('pending','running') AND vague >= 900)::bigint,
    count(*) FILTER (WHERE status = 'pending' AND rate_limit_retries > 0)::bigint,
    count(*) FILTER (WHERE status = 'failed' AND last_error ILIKE '%Throttle Uber%')::bigint,
    min(month_start) FILTER (WHERE status IN ('pending','running')),
    max(month_end) FILTER (WHERE status IN ('pending','running'))
  FROM public.backfill_jobs
  WHERE report_type = 'PAYMENT_DETAILS_REPORT';
$function$;