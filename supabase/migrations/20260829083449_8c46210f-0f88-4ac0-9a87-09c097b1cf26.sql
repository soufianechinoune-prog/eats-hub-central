UPDATE public.backfill_jobs
SET month_end = DATE '2026-08-27',
    status = 'pending',
    attempts = 0,
    rate_limit_retries = 0,
    last_error = NULL,
    next_attempt_at = NULL,
    started_at = NULL,
    completed_at = NULL,
    created_at = now() - interval '5 years',
    updated_at = now()
WHERE report_type = 'PAYMENT_DETAILS_REPORT'
  AND month_start = DATE '2026-08-16';