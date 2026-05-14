-- Relancer les jobs mai 2026 vague=6 qui ont failed sur la règle Uber J-2.
-- La nouvelle logique du worker cap automatiquement endDate.
UPDATE public.backfill_jobs
SET status = 'pending',
    attempts = 0,
    last_error = NULL,
    updated_at = now()
WHERE vague = 6
  AND status = 'failed'
  AND last_error LIKE '%endDate must be 2 days before current date%';