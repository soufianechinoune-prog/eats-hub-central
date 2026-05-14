UPDATE public.backfill_jobs
SET status = 'skipped',
    last_error = 'Hors fenêtre API Uber (188 jours max). Utilise l''import CSV pour cet historique.',
    updated_at = now()
WHERE vague = 6
  AND status IN ('pending', 'failed');