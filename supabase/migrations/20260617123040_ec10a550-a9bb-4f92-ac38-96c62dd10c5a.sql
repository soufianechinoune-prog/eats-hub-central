UPDATE backfill_jobs
SET status = 'pending',
    attempts = 0,
    last_error = NULL,
    next_attempt_at = NULL,
    started_at = NULL,
    completed_at = NULL,
    report_id = NULL,
    updated_at = now()
WHERE report_type IN ('ORDER_HISTORY_REPORT','ORDER_ERRORS_TRANSACTION_REPORT')
  AND month_start IN ('2026-04-01','2026-05-01','2026-06-01')
  AND status IN ('done','failed');