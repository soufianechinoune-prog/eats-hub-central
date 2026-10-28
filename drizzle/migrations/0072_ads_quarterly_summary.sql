-- lovable-cron-fallback-reviewed: one-time backfill of the two new revenue columns, one month per minute, job unschedules itself when finished
ALTER TABLE public.orders_daily_summary
  ADD COLUMN IF NOT EXISTS rev_net_ttc numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rev_net_ht numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders_daily_summary_state
  ADD COLUMN IF NOT EXISTS ht_backfill_cursor date NOT NULL DEFAULT date '2020-01-01',
  ADD COLUMN IF NOT EXISTS ht_backfill_done boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ods_recompute_range(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start timestamptz := ((p_start::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris');
  v_end timestamptz := ((p_end::timestamp + interval '1 day 4 hours') AT TIME ZONE 'Europe/Paris');
  v_ids uuid[] := COALESCE(p_restaurant_ids, (SELECT array_agg(id) FROM restaurants));
BEGIN
  DELETE FROM orders_daily_summary s
   WHERE s.day BETWEEN p_start AND p_end AND s.restaurant_id = ANY(v_ids);
  INSERT INTO orders_daily_summary(restaurant_id, day, sales_incl_vat, sales_incl_vat_pos, net_payout, item_promo_incl_vat_abs, meal_voucher, order_count, rev_net_ttc, rev_net_ht, refreshed_at)
  SELECT ids.rid, ods_business_day(o.order_datetime),
    COALESCE(SUM(o.sales_incl_vat),0), COALESCE(SUM(GREATEST(o.sales_incl_vat,0)),0),
    COALESCE(SUM(o.net_payout),0), COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat,0))),0),
    COALESCE(SUM(COALESCE(o.meal_voucher_amount,0)),0), COUNT(*),
    COALESCE(SUM(COALESCE(o.sales_incl_vat,0)+COALESCE(o.item_promo_incl_vat,0)),0),
    COALESCE(SUM(COALESCE(o.sales_excl_vat,0)+COALESCE(o.item_promo_excl_vat,0)),0),
    now()
  FROM unnest(v_ids) ids(rid)
  CROSS JOIN LATERAL (
    SELECT x.order_datetime, x.sales_incl_vat, x.sales_excl_vat, x.net_payout, x.item_promo_incl_vat, x.item_promo_excl_vat, x.meal_voucher_amount
    FROM orders x WHERE x.restaurant_id = ids.rid AND x.order_datetime >= v_start AND x.order_datetime < v_end
  ) o
  GROUP BY 1, 2;
END $$;
REVOKE ALL ON FUNCTION public.ods_recompute_range(date,date,uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ods_ht_backfill_step()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '55s' AS $$
DECLARE v_state record; v_month_end date;
BEGIN
  SELECT * INTO v_state FROM orders_daily_summary_state WHERE id = 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN 'busy'; END IF;
  IF v_state.ht_backfill_done THEN
    PERFORM cron.unschedule('ods-ht-backfill');
    RETURN 'done';
  END IF;
  v_month_end := (date_trunc('month', v_state.ht_backfill_cursor) + interval '1 month - 1 day')::date;
  PERFORM ods_recompute_range(v_state.ht_backfill_cursor, v_month_end, NULL);
  UPDATE orders_daily_summary_state
     SET ht_backfill_cursor = v_month_end + 1,
         ht_backfill_done = (v_month_end >= (now() AT TIME ZONE 'Europe/Paris')::date),
         updated_at = now()
   WHERE id = 1;
  RETURN v_month_end::text;
END $$;
REVOKE ALL ON FUNCTION public.ods_ht_backfill_step() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('ods-ht-backfill', '* * * * *', 'SELECT public.ods_ht_backfill_step()');

CREATE OR REPLACE FUNCTION public.get_ads_quarterly_summary(p_year int, p_restaurant_ids uuid[])
RETURNS TABLE(q_year int, quarter int, restaurant_id uuid, ads_spend_ht numeric, revenue_net_ttc numeric, revenue_net_ht numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '20s'
AS $$
DECLARE
  v_start date := make_date(p_year - 1, 10, 1);
  v_end date := LEAST(make_date(p_year, 12, 31), (now() AT TIME ZONE 'Europe/Paris')::date);
  v_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) INTO v_ids FROM restaurants r
   WHERE r.id = ANY(p_restaurant_ids) AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id));
  IF array_length(v_ids,1) IS NULL OR v_end < v_start THEN RETURN; END IF;
  IF (SELECT ht_backfill_done FROM orders_daily_summary_state WHERE id = 1) THEN
    RETURN QUERY
    WITH ads AS (
      SELECT pa.restaurant_id rid, public.ads_reporting_date(pa.payout_date) d, ABS(SUM(pa.amount)) a
      FROM payout_adjustments pa
      WHERE pa.category = 'advertising' AND pa.restaurant_id = ANY(v_ids)
        AND pa.payout_date BETWEEN v_start AND v_end + 1
      GROUP BY 1, 2
    ), a2 AS (
      SELECT rid, EXTRACT(YEAR FROM d)::int y, EXTRACT(QUARTER FROM d)::int q, SUM(a) a FROM ads
      WHERE d BETWEEN v_start AND v_end GROUP BY 1,2,3
    ), rv AS (
      SELECT s.restaurant_id rid, EXTRACT(YEAR FROM s.day)::int y, EXTRACT(QUARTER FROM s.day)::int q,
        SUM(s.rev_net_ttc) ttc, SUM(s.rev_net_ht) ht
      FROM orders_daily_summary s
      WHERE s.restaurant_id = ANY(v_ids) AND s.day BETWEEN v_start AND v_end
      GROUP BY 1,2,3
    )
    SELECT COALESCE(rv.y, a2.y), COALESCE(rv.q, a2.q), COALESCE(rv.rid, a2.rid),
      COALESCE(a2.a,0)::numeric, COALESCE(rv.ttc,0)::numeric, COALESCE(rv.ht,0)::numeric
    FROM rv FULL JOIN a2 ON a2.rid = rv.rid AND a2.y = rv.y AND a2.q = rv.q;
    RETURN;
  END IF;
  -- Fallback until the one-time backfill is done: same per-quarter numbers from the ratio RPC
  RETURN QUERY
  SELECT EXTRACT(YEAR FROM qs)::int, EXTRACT(QUARTER FROM qs)::int, m.restaurant_id, m.ads_spend_ht, m.revenue_net_ttc, m.revenue_net_ht
  FROM generate_series(v_start, v_end, interval '3 months') qs
  CROSS JOIN LATERAL public.get_ads_revenue_ratio_modes(qs::date, LEAST((qs + interval '3 months - 1 day')::date, v_end), v_ids) m;
END $$;
REVOKE ALL ON FUNCTION public.get_ads_quarterly_summary(int, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ads_quarterly_summary(int, uuid[]) TO authenticated, service_role;