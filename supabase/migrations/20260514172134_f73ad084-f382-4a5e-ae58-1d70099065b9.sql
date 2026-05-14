
CREATE OR REPLACE FUNCTION public.enqueue_payment_details_backfill(p_restaurant_id uuid, p_months date[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_resto record;
  v_month date;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super admin only';
  END IF;

  SELECT id, name, uber_store_id INTO v_resto
  FROM restaurants WHERE id = p_restaurant_id;

  IF v_resto.id IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;
  IF v_resto.uber_store_id IS NULL OR v_resto.uber_store_id = '' THEN
    RAISE EXCEPTION 'Restaurant has no uber_store_id';
  END IF;

  FOREACH v_month IN ARRAY p_months LOOP
    -- PAYMENT_DETAILS_REPORT n'a PAS de limite 188 jours côté Uber.
    INSERT INTO backfill_jobs (
      restaurant_id, restaurant_name, uber_store_id,
      month_start, month_end,
      status, attempts, report_type, vague
    ) VALUES (
      v_resto.id, v_resto.name, v_resto.uber_store_id,
      date_trunc('month', v_month)::date,
      (date_trunc('month', v_month) + interval '1 month - 1 day')::date,
      'pending', 0, 'PAYMENT_DETAILS_REPORT', 1
    )
    ON CONFLICT ON CONSTRAINT backfill_jobs_unique_resto_month_type
    DO UPDATE SET
      status = 'pending',
      attempts = 0,
      last_error = NULL,
      started_at = NULL,
      updated_at = now(),
      vague = 1;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.enqueue_payment_details_backfill(uuid, date[]) TO authenticated;
