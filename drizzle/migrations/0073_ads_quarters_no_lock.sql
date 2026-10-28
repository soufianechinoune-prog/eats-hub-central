CREATE OR REPLACE FUNCTION public.ods_ht_backfill_step()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '55s'
AS $function$
DECLARE v_state record; v_month_end date; v_cursor date;
BEGIN
  SELECT * INTO v_state FROM orders_daily_summary_state WHERE id = 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN 'busy'; END IF;
  IF v_state.ht_backfill_done THEN
    PERFORM cron.unschedule('ods-ht-backfill');
    RETURN 'done';
  END IF;
  -- Only displayed years matter (N-1 Q4 onward): start at 2025-01-01
  v_cursor := GREATEST(v_state.ht_backfill_cursor, DATE '2025-01-01');
  v_month_end := (date_trunc('month', v_cursor) + interval '1 month - 1 day')::date;
  PERFORM ods_recompute_range(v_cursor, v_month_end, NULL);
  UPDATE orders_daily_summary_state
     SET ht_backfill_cursor = v_month_end + 1,
         ht_backfill_done = (v_month_end >= (now() AT TIME ZONE 'Europe/Paris')::date),
         updated_at = now()
   WHERE id = 1;
  RETURN v_month_end::text;
END $function$;

CREATE OR REPLACE FUNCTION public.get_ads_quarterly_summary(p_year integer, p_restaurant_ids uuid[])
 RETURNS TABLE(q_year integer, quarter integer, restaurant_id uuid, ads_spend_ht numeric, revenue_net_ttc numeric, revenue_net_ht numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '20s'
AS $function$
DECLARE
  v_start date := make_date(p_year - 1, 10, 1);
  v_end date := LEAST(make_date(p_year, 12, 31), (now() AT TIME ZONE 'Europe/Paris')::date);
  v_ids uuid[];
BEGIN
  -- Brand isolation: keep only restaurants the caller can access
  SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) INTO v_ids FROM restaurants r
   WHERE r.id = ANY(p_restaurant_ids) AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id));
  IF array_length(v_ids,1) IS NULL OR v_end < v_start THEN RETURN; END IF;
  RETURN QUERY
  WITH ads AS (
    SELECT pa.restaurant_id rid, public.ads_reporting_date(pa.payout_date) d, ABS(SUM(pa.amount)) a
    FROM payout_adjustments pa
    WHERE pa.category = 'advertising' AND pa.restaurant_id = ANY(v_ids)
      AND pa.payout_date BETWEEN v_start AND v_end + 1
    GROUP BY 1, 2
  ), a2 AS (
    SELECT ads.rid, EXTRACT(YEAR FROM ads.d)::int y, EXTRACT(QUARTER FROM ads.d)::int q, SUM(ads.a) a FROM ads
    WHERE ads.d BETWEEN v_start AND v_end GROUP BY 1,2,3
  ), rv AS (
    SELECT s.restaurant_id rid, EXTRACT(YEAR FROM s.day)::int y, EXTRACT(QUARTER FROM s.day)::int q,
      -- TTC net always derivable from base columns; HT uses the new column once recomputed
      SUM(s.sales_incl_vat - s.item_promo_incl_vat_abs) ttc,
      SUM(s.rev_net_ht) ht
    FROM orders_daily_summary s
    WHERE s.restaurant_id = ANY(v_ids) AND s.day BETWEEN v_start AND v_end
    GROUP BY 1,2,3
  )
  SELECT COALESCE(rv.y, a2.y), COALESCE(rv.q, a2.q), COALESCE(rv.rid, a2.rid),
    COALESCE(a2.a,0)::numeric, COALESCE(rv.ttc,0)::numeric, COALESCE(rv.ht,0)::numeric
  FROM rv FULL JOIN a2 ON a2.rid = rv.rid AND a2.y = rv.y AND a2.q = rv.q;
END $function$;