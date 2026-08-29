INSERT INTO public.backfill_jobs (restaurant_id, restaurant_name, uber_store_id, month_start, month_end, report_type, vague, status, created_at)
SELECT r.id, r.name, r.uber_store_id, DATE '2026-08-15', DATE '2026-08-27', 'PAYMENT_DETAILS_REPORT', 998, 'pending', now() - interval '5 years'
FROM public.restaurants r
WHERE r.uber_store_id IS NOT NULL AND r.uber_store_id <> ''
ON CONFLICT (restaurant_id, month_start, report_type) DO NOTHING;