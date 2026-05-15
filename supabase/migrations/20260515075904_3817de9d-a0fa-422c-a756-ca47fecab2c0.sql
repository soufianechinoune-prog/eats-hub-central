DROP FUNCTION IF EXISTS public.resync_live_tag_all_restaurants();

CREATE OR REPLACE FUNCTION public.resync_live_tag_all_restaurants()
RETURNS TABLE(restaurant_id uuid, restaurant_name text, retagged_count integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '600s'
AS $function$
DECLARE
  rec RECORD;
  v_count int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super admin only';
  END IF;

  PERFORM set_config('lock_timeout', '30s', true);

  FOR rec IN
    SELECT bj.restaurant_id AS rid, r.name AS rname
    FROM public.backfill_jobs bj
    JOIN public.restaurants r ON r.id = bj.restaurant_id
    WHERE bj.status = 'done'
      AND bj.report_type = 'PAYMENT_DETAILS_REPORT'
    GROUP BY bj.restaurant_id, r.name
  LOOP
    BEGIN
      WITH updated AS (
        UPDATE public.orders o
        SET data_source = 'uber_api'
        FROM public.backfill_jobs bj
        WHERE bj.restaurant_id = rec.rid
          AND bj.status = 'done'
          AND bj.report_type = 'PAYMENT_DETAILS_REPORT'
          AND o.restaurant_id = rec.rid
          AND o.order_datetime >= bj.month_start::timestamptz
          AND o.order_datetime < (bj.month_end + INTERVAL '1 day')::timestamptz
          AND (o.data_source IS NULL OR o.data_source <> 'uber_api')
        RETURNING 1
      )
      SELECT COUNT(*)::int INTO v_count FROM updated;

      IF v_count > 0 THEN
        restaurant_id := rec.rid;
        restaurant_name := rec.rname;
        retagged_count := v_count;
        status := 'ok';
        RETURN NEXT;
      END IF;
    EXCEPTION
      WHEN lock_not_available OR query_canceled THEN
        restaurant_id := rec.rid;
        restaurant_name := rec.rname;
        retagged_count := 0;
        status := 'locked';
        RETURN NEXT;
      WHEN OTHERS THEN
        restaurant_id := rec.rid;
        restaurant_name := rec.rname;
        retagged_count := 0;
        status := 'error';
        RETURN NEXT;
    END;
  END LOOP;
END;
$function$;