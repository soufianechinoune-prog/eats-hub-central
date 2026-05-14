
CREATE OR REPLACE FUNCTION public.resync_live_tag_all_restaurants()
RETURNS TABLE(restaurant_id uuid, restaurant_name text, retagged_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '300s'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super admin only';
  END IF;

  RETURN QUERY
  WITH updated AS (
    UPDATE public.orders o
    SET data_source = 'uber_api'
    FROM public.backfill_jobs bj
    WHERE bj.status = 'done'
      AND bj.report_type = 'PAYMENT_DETAILS_REPORT'
      AND o.restaurant_id = bj.restaurant_id
      AND o.order_datetime >= bj.month_start::timestamptz
      AND o.order_datetime < (bj.month_end + INTERVAL '1 day')::timestamptz
      AND (o.data_source IS NULL OR o.data_source <> 'uber_api')
    RETURNING o.restaurant_id AS rid
  ),
  agg AS (
    SELECT u.rid, COUNT(*)::int AS cnt
    FROM updated u
    GROUP BY u.rid
  )
  SELECT a.rid, r.name, a.cnt
  FROM agg a
  JOIN public.restaurants r ON r.id = a.rid
  ORDER BY a.cnt DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resync_live_tag_all_restaurants() TO authenticated;
