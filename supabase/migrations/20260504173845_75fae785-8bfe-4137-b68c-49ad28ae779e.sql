-- 1. Colonnes
ALTER TABLE public.backfill_jobs 
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'PAYMENT_DETAILS_REPORT',
  ADD COLUMN IF NOT EXISTS vague integer NOT NULL DEFAULT 1;

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_backfill_jobs_picker
  ON public.backfill_jobs (status, vague, restaurant_name, month_start);
CREATE INDEX IF NOT EXISTS idx_backfill_jobs_report_type
  ON public.backfill_jobs (report_type, status);

-- 3. Unique composite
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backfill_jobs_unique_resto_month') THEN
    ALTER TABLE public.backfill_jobs DROP CONSTRAINT backfill_jobs_unique_resto_month;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backfill_jobs_unique_resto_month_type') THEN
    ALTER TABLE public.backfill_jobs
      ADD CONSTRAINT backfill_jobs_unique_resto_month_type
      UNIQUE (restaurant_id, month_start, report_type);
  END IF;
END $$;

-- 4. Drop + recreate seed
DROP FUNCTION IF EXISTS public.seed_backfill_jobs(date, date, uuid[]);
DROP FUNCTION IF EXISTS public.seed_backfill_jobs(date, date, uuid[], text[]);

CREATE OR REPLACE FUNCTION public.seed_backfill_jobs(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_report_types text[] DEFAULT ARRAY['PAYMENT_DETAILS_REPORT']::text[]
)
RETURNS TABLE (inserted_count integer, skipped_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_total_before integer;
  v_total_after integer;
  v_attempted integer;
  v_vague_map jsonb := '{
    "PAYMENT_DETAILS_REPORT": 1,
    "MENU_ITEM_FEEDBACK_REPORT": 2,
    "CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT": 3,
    "ORDER_ERRORS_TRANSACTION_REPORT": 4,
    "DOWNTIME_REPORT": 5
  }'::jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can seed backfill jobs';
  END IF;

  SELECT COUNT(*) INTO v_total_before FROM public.backfill_jobs;

  WITH months AS (
    SELECT generate_series(
      date_trunc('month', p_start_date)::date,
      date_trunc('month', p_end_date)::date,
      '1 month'::interval
    )::date AS month_start
  ),
  restos AS (
    SELECT id, name, uber_store_id FROM public.restaurants
    WHERE uber_store_id IS NOT NULL AND uber_store_id <> ''
      AND (p_restaurant_ids IS NULL OR id = ANY(p_restaurant_ids))
  ),
  types AS (SELECT unnest(p_report_types) AS report_type)
  INSERT INTO public.backfill_jobs (
    restaurant_id, restaurant_name, uber_store_id,
    month_start, month_end, status, report_type, vague
  )
  SELECT
    r.id, r.name, r.uber_store_id,
    m.month_start,
    (m.month_start + interval '1 month' - interval '1 day')::date,
    'pending', t.report_type,
    COALESCE((v_vague_map ->> t.report_type)::integer, 99)
  FROM restos r CROSS JOIN months m CROSS JOIN types t
  ON CONFLICT (restaurant_id, month_start, report_type) DO NOTHING;

  SELECT COUNT(*) INTO v_total_after FROM public.backfill_jobs;
  v_inserted := v_total_after - v_total_before;

  v_attempted := (
    (SELECT COUNT(*)::int FROM generate_series(
      date_trunc('month', p_start_date)::date,
      date_trunc('month', p_end_date)::date,
      '1 month'::interval) g)
    * (SELECT COUNT(*)::int FROM public.restaurants 
       WHERE uber_store_id IS NOT NULL AND uber_store_id <> ''
       AND (p_restaurant_ids IS NULL OR id = ANY(p_restaurant_ids)))
    * COALESCE(array_length(p_report_types, 1), 0)
  );
  v_skipped := GREATEST(v_attempted - v_inserted, 0);

  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$$;

-- 5. Drop + recreate picker (return type changed)
DROP FUNCTION IF EXISTS public.pick_next_backfill_job();

CREATE OR REPLACE FUNCTION public.pick_next_backfill_job()
RETURNS TABLE (
  job_id uuid,
  restaurant_id uuid,
  restaurant_name text,
  uber_store_id text,
  month_start date,
  month_end date,
  attempts integer,
  report_type text,
  vague integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_job_id uuid;
BEGIN
  UPDATE public.backfill_jobs
  SET status = 'running', started_at = now(),
      attempts = attempts + 1, updated_at = now()
  WHERE id = (
    SELECT id FROM public.backfill_jobs
    WHERE status = 'pending'
    ORDER BY vague ASC, restaurant_name ASC, month_start ASC
    LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT j.id, j.restaurant_id, j.restaurant_name, j.uber_store_id,
         j.month_start, j.month_end, j.attempts, j.report_type, j.vague
  FROM public.backfill_jobs j WHERE j.id = v_job_id;
END;
$$;

-- 6. Vue stats globale (refresh)
DROP VIEW IF EXISTS public.backfill_jobs_stats;
CREATE VIEW public.backfill_jobs_stats
WITH (security_invoker = true)
AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending,
  COUNT(*) FILTER (WHERE status = 'running')::integer AS running,
  COUNT(*) FILTER (WHERE status = 'done')::integer AS done,
  COUNT(*) FILTER (WHERE status = 'failed')::integer AS failed,
  COUNT(*) FILTER (WHERE status = 'skipped')::integer AS skipped,
  COUNT(*)::integer AS total,
  MIN(started_at) AS started_at,
  MAX(completed_at) AS last_completed_at
FROM public.backfill_jobs;

-- 7. Vue stats par vague
DROP VIEW IF EXISTS public.backfill_jobs_stats_by_vague;
CREATE VIEW public.backfill_jobs_stats_by_vague
WITH (security_invoker = true)
AS
SELECT
  vague,
  report_type,
  COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending,
  COUNT(*) FILTER (WHERE status = 'running')::integer AS running,
  COUNT(*) FILTER (WHERE status = 'done')::integer AS done,
  COUNT(*) FILTER (WHERE status = 'failed')::integer AS failed,
  COUNT(*) FILTER (WHERE status = 'skipped')::integer AS skipped,
  COUNT(*)::integer AS total
FROM public.backfill_jobs
GROUP BY vague, report_type
ORDER BY vague;