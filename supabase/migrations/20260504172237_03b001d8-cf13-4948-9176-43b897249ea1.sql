DROP VIEW IF EXISTS public.backfill_jobs_stats;

CREATE VIEW public.backfill_jobs_stats
WITH (security_invoker = true) AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'running') AS running,
  COUNT(*) FILTER (WHERE status = 'done') AS done,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
  COUNT(*) AS total,
  MIN(started_at) FILTER (WHERE status IN ('done','running')) AS started_at,
  MAX(completed_at) FILTER (WHERE status = 'done') AS last_completed_at
FROM public.backfill_jobs;

GRANT SELECT ON public.backfill_jobs_stats TO authenticated;