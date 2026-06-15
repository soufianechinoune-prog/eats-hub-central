INSERT INTO public.backfill_jobs (restaurant_id, restaurant_name, uber_store_id, month_start, month_end, report_type, status, vague)
SELECT r.id, r.name, r.uber_store_id, w.month_start, w.month_end, t.report_type, 'pending', 100
FROM (
  SELECT r.id, r.name, r.uber_store_id
  FROM public.restaurants r
  JOIN public.chains c ON c.id = r.chain_id
  WHERE c.name IN ('Chicken Street', 'TASTY CROUSTY')
    AND r.uber_store_id IS NOT NULL
) r
CROSS JOIN (VALUES
  (DATE '2026-01-01', DATE '2026-01-31'),
  (DATE '2026-02-01', DATE '2026-02-28'),
  (DATE '2026-03-01', DATE '2026-03-31'),
  (DATE '2026-04-01', DATE '2026-04-30'),
  (DATE '2026-05-01', DATE '2026-05-31'),
  (DATE '2026-06-01', DATE '2026-06-13')
) AS w(month_start, month_end)
CROSS JOIN (VALUES
  ('ORDER_HISTORY_REPORT'),
  ('CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT'),
  ('MENU_ITEM_FEEDBACK_REPORT'),
  ('DOWNTIME_REPORT'),
  ('ORDER_ERRORS_TRANSACTION_REPORT')
) AS t(report_type)
ON CONFLICT (restaurant_id, month_start, report_type) DO NOTHING;