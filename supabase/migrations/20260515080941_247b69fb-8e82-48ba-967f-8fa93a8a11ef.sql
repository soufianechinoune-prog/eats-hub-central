CREATE OR REPLACE FUNCTION public.resync_live_tag_restaurants(p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
  restaurant_id uuid,
  restaurant_name text,
  retagged_count integer,
  status text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '600s'
AS $function$
DECLARE
  resto RECORD;
  job RECORD;
  v_month_count int;
  v_total_count int;
  v_had_issue boolean;
  v_message text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super admin only';
  END IF;

  PERFORM set_config('lock_timeout', '30s', true);

  FOR resto IN
    SELECT DISTINCT r.id, r.name
    FROM public.restaurants r
    JOIN public.backfill_jobs bj ON bj.restaurant_id = r.id
    WHERE bj.status = 'done'
      AND bj.report_type = 'PAYMENT_DETAILS_REPORT'
      AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids))
    ORDER BY r.name
  LOOP
    v_total_count := 0;
    v_had_issue := false;
    v_message := NULL;

    FOR job IN
      SELECT bj.month_start, bj.month_end
      FROM public.backfill_jobs bj
      WHERE bj.restaurant_id = resto.id
        AND bj.status = 'done'
        AND bj.report_type = 'PAYMENT_DETAILS_REPORT'
      ORDER BY bj.month_start
    LOOP
      BEGIN
        WITH updated AS (
          UPDATE public.orders o
          SET data_source = 'uber_api'
          WHERE o.restaurant_id = resto.id
            AND o.order_datetime >= job.month_start::timestamptz
            AND o.order_datetime < (job.month_end + INTERVAL '1 day')::timestamptz
            AND o.data_source IS DISTINCT FROM 'uber_api'
          RETURNING 1
        )
        SELECT COUNT(*)::int INTO v_month_count FROM updated;

        v_total_count := v_total_count + COALESCE(v_month_count, 0);
      EXCEPTION
        WHEN lock_not_available OR query_canceled THEN
          v_had_issue := true;
          v_message := COALESCE(v_message || '; ', '') || to_char(job.month_start, 'YYYY-MM') || ' verrouillé/timeout';
        WHEN OTHERS THEN
          v_had_issue := true;
          v_message := COALESCE(v_message || '; ', '') || to_char(job.month_start, 'YYYY-MM') || ' erreur: ' || SQLERRM;
      END;
    END LOOP;

    restaurant_id := resto.id;
    restaurant_name := resto.name;
    retagged_count := v_total_count;
    status := CASE WHEN v_had_issue THEN 'partial' ELSE 'ok' END;
    message := COALESCE(v_message, 'OK');
    RETURN NEXT;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resync_live_tag_restaurants(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.resync_live_tag_all_restaurants()
RETURNS TABLE(restaurant_id uuid, restaurant_name text, retagged_count integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '600s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT r.restaurant_id, r.restaurant_name, r.retagged_count, r.status
  FROM public.resync_live_tag_restaurants(NULL::uuid[]) r
  WHERE r.retagged_count > 0 OR r.status <> 'ok';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resync_live_tag_all_restaurants() TO authenticated;