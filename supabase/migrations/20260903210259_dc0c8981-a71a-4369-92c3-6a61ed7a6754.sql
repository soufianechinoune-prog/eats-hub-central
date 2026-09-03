-- 1. Uber a confirmé l'activation POS de tous les stores fournis :
--    on active localement les boutiques actives encore marquées non autorisées.
UPDATE public.restaurants
SET uber_pos_activated_at = now()
WHERE is_active
  AND uber_store_id IS NOT NULL
  AND uber_store_id <> ''
  AND uber_pos_activated_at IS NULL;

-- 2. État de la file de rattrapage des versements (lecture seule, pour le bandeau UI)
CREATE OR REPLACE FUNCTION public.get_payout_backfill_queue_status()
RETURNS TABLE (
  pending_jobs bigint,
  running_jobs bigint,
  retro_jobs bigint,
  oldest_window date,
  newest_window date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE status = 'pending')::bigint,
    count(*) FILTER (WHERE status = 'running')::bigint,
    count(*) FILTER (WHERE status IN ('pending','running') AND vague = 900)::bigint,
    min(month_start) FILTER (WHERE status IN ('pending','running')),
    max(month_end) FILTER (WHERE status IN ('pending','running'))
  FROM public.backfill_jobs
  WHERE report_type = 'PAYMENT_DETAILS_REPORT';
$$;

REVOKE ALL ON FUNCTION public.get_payout_backfill_queue_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payout_backfill_queue_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payout_backfill_queue_status() TO service_role;