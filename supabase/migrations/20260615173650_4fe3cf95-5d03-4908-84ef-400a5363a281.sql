INSERT INTO public.backfill_jobs (restaurant_id, restaurant_name, uber_store_id, month_start, month_end, report_type, status, vague)
VALUES
 ('fe6d9c19-dd7a-4554-a29d-6b6f5a73a455','TASTY CROUSTY PARIS 18','044b1b5c-1901-5204-999e-ac11fc570983','2026-01-06','2026-01-12','PAYMENT_DETAILS_REPORT','pending',99),
 ('fe6d9c19-dd7a-4554-a29d-6b6f5a73a455','TASTY CROUSTY PARIS 18','044b1b5c-1901-5204-999e-ac11fc570983','2026-01-06','2026-01-12','CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT','pending',99),
 ('fe6d9c19-dd7a-4554-a29d-6b6f5a73a455','TASTY CROUSTY PARIS 18','044b1b5c-1901-5204-999e-ac11fc570983','2026-01-06','2026-01-12','MENU_ITEM_FEEDBACK_REPORT','pending',99),
 ('fe6d9c19-dd7a-4554-a29d-6b6f5a73a455','TASTY CROUSTY PARIS 18','044b1b5c-1901-5204-999e-ac11fc570983','2026-01-06','2026-01-12','DOWNTIME_REPORT','pending',99),
 ('fe6d9c19-dd7a-4554-a29d-6b6f5a73a455','TASTY CROUSTY PARIS 18','044b1b5c-1901-5204-999e-ac11fc570983','2026-01-06','2026-01-12','ORDER_ERRORS_TRANSACTION_REPORT','pending',99)
ON CONFLICT (restaurant_id, month_start, report_type) DO UPDATE 
  SET status='pending', attempts=0, last_error=NULL, vague=99, updated_at=now();