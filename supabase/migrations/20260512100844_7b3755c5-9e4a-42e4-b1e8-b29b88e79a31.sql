-- 1. Marquer comme 'skipped' tous les jobs V2-V5 (pending OU failed) hors fenêtre Uber 188 jours
UPDATE public.backfill_jobs
SET 
  status = 'skipped',
  last_error = COALESCE(last_error, 'Hors fenêtre API Uber (188 jours max pour ce type de rapport)'),
  completed_at = now(),
  updated_at = now()
WHERE vague >= 2
  AND status IN ('pending', 'failed')
  AND month_start < (CURRENT_DATE - INTERVAL '188 days');

-- 2. Mettre à jour seed_backfill_jobs pour ne plus créer de jobs V2-V5 > 188j
CREATE OR REPLACE FUNCTION public.seed_backfill_jobs(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[],
  p_report_types text[] DEFAULT ARRAY['PAYMENT_DETAILS_REPORT'::text]
)
RETURNS TABLE(inserted_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_total_before integer;
  v_total_after integer;
  v_vague_map jsonb := '{
    "PAYMENT_DETAILS_REPORT": 1,
    "MENU_ITEM_FEEDBACK_REPORT": 2,
    "CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT": 3,
    "ORDER_ERRORS_TRANSACTION_REPORT": 4,
    "DOWNTIME_REPORT": 5
  }'::jsonb;
  v_188_cutoff date := CURRENT_DATE - INTERVAL '188 days';
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
    'pending',
    t.report_type,
    COALESCE((v_vague_map ->> t.report_type)::int, 1)
  FROM restos r
  CROSS JOIN months m
  CROSS JOIN types t
  -- Filtrer : pas de jobs V2-V5 hors fenêtre Uber 188 jours
  WHERE NOT (
    COALESCE((v_vague_map ->> t.report_type)::int, 1) >= 2
    AND (m.month_start + interval '1 month' - interval '1 day')::date < v_188_cutoff
  )
  ON CONFLICT (restaurant_id, month_start, report_type) DO NOTHING;

  SELECT COUNT(*) INTO v_total_after FROM public.backfill_jobs;
  v_inserted := v_total_after - v_total_before;

  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$function$;