-- lovable-cron-fallback-reviewed: one-time history backfill, one month per minute, job unschedules itself when finished (~80 runs total)
CREATE TABLE public.orders_daily_summary (
  restaurant_id uuid NOT NULL,
  day date NOT NULL,
  sales_incl_vat numeric NOT NULL DEFAULT 0,
  sales_incl_vat_pos numeric NOT NULL DEFAULT 0,
  net_payout numeric NOT NULL DEFAULT 0,
  item_promo_incl_vat_abs numeric NOT NULL DEFAULT 0,
  meal_voucher numeric NOT NULL DEFAULT 0,
  order_count bigint NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, day)
);
CREATE INDEX idx_ods_day ON public.orders_daily_summary(day);
GRANT ALL ON public.orders_daily_summary TO service_role;
ALTER TABLE public.orders_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.orders_daily_summary_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  backfill_cursor date NOT NULL DEFAULT date '2020-01-01',
  backfill_done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.orders_daily_summary_state TO service_role;
ALTER TABLE public.orders_daily_summary_state ENABLE ROW LEVEL SECURITY;
INSERT INTO public.orders_daily_summary_state(id) VALUES (1);

CREATE OR REPLACE FUNCTION public.ods_business_day(ts timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE AS $$ SELECT ((ts AT TIME ZONE 'Europe/Paris') - interval '4 hours')::date $$;

-- Recompute a range for given restaurants (NULL = all) from raw orders
CREATE OR REPLACE FUNCTION public.ods_recompute_range(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start timestamptz := ((p_start::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris');
  v_end timestamptz := ((p_end::timestamp + interval '1 day 4 hours') AT TIME ZONE 'Europe/Paris');
BEGIN
  DELETE FROM orders_daily_summary s
   WHERE s.day BETWEEN p_start AND p_end
     AND (p_restaurant_ids IS NULL OR s.restaurant_id = ANY(p_restaurant_ids));
  INSERT INTO orders_daily_summary(restaurant_id, day, sales_incl_vat, sales_incl_vat_pos, net_payout, item_promo_incl_vat_abs, meal_voucher, order_count, refreshed_at)
  SELECT o.restaurant_id, ods_business_day(o.order_datetime),
    COALESCE(SUM(o.sales_incl_vat),0), COALESCE(SUM(GREATEST(o.sales_incl_vat,0)),0),
    COALESCE(SUM(o.net_payout),0), COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat,0))),0),
    COALESCE(SUM(COALESCE(o.meal_voucher_amount,0)),0), COUNT(*), now()
  FROM orders o
  WHERE o.restaurant_id IS NOT NULL
    AND o.order_datetime >= v_start AND o.order_datetime < v_end
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY 1, 2;
END $$;
REVOKE ALL ON FUNCTION public.ods_recompute_range(date,date,uuid[]) FROM PUBLIC, anon, authenticated;

-- Recompute exactly the (restaurant, day) pairs touched by one statement
CREATE OR REPLACE FUNCTION public.ods_recompute_pairs(p_pairs jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT (e->>'d')::date AS day, array_agg((e->>'r')::uuid) AS ids
    FROM jsonb_array_elements(p_pairs) e GROUP BY 1
  LOOP
    PERFORM ods_recompute_range(r.day, r.day, r.ids);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.ods_recompute_pairs(jsonb) FROM PUBLIC, anon, authenticated;

-- Statement-level triggers: one recompute per batch, never per row
CREATE OR REPLACE FUNCTION public.ods_trg_new() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM ods_recompute_pairs(COALESCE((SELECT jsonb_agg(jsonb_build_object('r', restaurant_id, 'd', d)) FROM
    (SELECT DISTINCT restaurant_id, ods_business_day(order_datetime) d FROM new_rows WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL) x), '[]'));
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.ods_trg_old() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM ods_recompute_pairs(COALESCE((SELECT jsonb_agg(jsonb_build_object('r', restaurant_id, 'd', d)) FROM
    (SELECT DISTINCT restaurant_id, ods_business_day(order_datetime) d FROM old_rows WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL) x), '[]'));
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.ods_trg_upd() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM ods_recompute_pairs(COALESCE((SELECT jsonb_agg(jsonb_build_object('r', restaurant_id, 'd', d)) FROM
    (SELECT restaurant_id, ods_business_day(order_datetime) d FROM new_rows WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL
     UNION
     SELECT restaurant_id, ods_business_day(order_datetime) d FROM old_rows WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL) x), '[]'));
  RETURN NULL;
END $$;
CREATE TRIGGER trg_ods_ins AFTER INSERT ON public.orders REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.ods_trg_new();
CREATE TRIGGER trg_ods_del AFTER DELETE ON public.orders REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.ods_trg_old();
CREATE TRIGGER trg_ods_upd AFTER UPDATE ON public.orders REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.ods_trg_upd();

-- One-time backfill step: one month per run, unschedules itself at the end
CREATE OR REPLACE FUNCTION public.ods_backfill_step()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '55s' AS $$
DECLARE v_state record; v_month_end date;
BEGIN
  SELECT * INTO v_state FROM orders_daily_summary_state WHERE id = 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN 'busy'; END IF;
  IF v_state.backfill_done THEN
    PERFORM cron.unschedule('ods-backfill');
    RETURN 'done';
  END IF;
  v_month_end := (date_trunc('month', v_state.backfill_cursor) + interval '1 month - 1 day')::date;
  PERFORM ods_recompute_range(v_state.backfill_cursor, v_month_end, NULL);
  UPDATE orders_daily_summary_state
     SET backfill_cursor = v_month_end + 1,
         backfill_done = (v_month_end >= (now() AT TIME ZONE 'Europe/Paris')::date),
         updated_at = now()
   WHERE id = 1;
  RETURN v_month_end::text;
END $$;
REVOKE ALL ON FUNCTION public.ods_backfill_step() FROM PUBLIC, anon, authenticated;

-- Nightly safety net: last 60 days
CREATE OR REPLACE FUNCTION public.ods_nightly()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '600s' AS $$
DECLARE d date := (now() AT TIME ZONE 'Europe/Paris')::date - 60;
BEGIN
  WHILE d <= (now() AT TIME ZONE 'Europe/Paris')::date LOOP
    PERFORM ods_recompute_range(d, d + 6, NULL);
    d := d + 7;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.ods_nightly() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('ods-backfill', '* * * * *', 'SELECT public.ods_backfill_step()');
SELECT cron.schedule('ods-nightly', '15 3 * * *', 'SELECT public.ods_nightly()');

CREATE OR REPLACE FUNCTION public.get_network_orders_summary(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, total_sales_incl_vat numeric, total_net_payout numeric, total_item_promo_incl_vat numeric, total_meal_voucher numeric, order_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '10s'
AS $function$
BEGIN
  IF (SELECT backfill_done FROM orders_daily_summary_state WHERE id = 1) THEN
    RETURN QUERY
    SELECT s.restaurant_id, SUM(s.sales_incl_vat_pos)::numeric, SUM(s.net_payout)::numeric,
      SUM(s.item_promo_incl_vat_abs)::numeric, SUM(s.meal_voucher)::numeric, SUM(s.order_count)::bigint
    FROM orders_daily_summary s
    WHERE s.restaurant_id = ANY(p_restaurant_ids) AND s.day BETWEEN p_start_date AND p_end_date
    GROUP BY s.restaurant_id;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT o.restaurant_id,
    COALESCE(SUM(GREATEST(o.sales_incl_vat, 0)), 0)::numeric,
    COALESCE(SUM(o.net_payout), 0)::numeric,
    COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat, 0))), 0)::numeric,
    COALESCE(SUM(COALESCE(o.meal_voucher_amount, 0)), 0)::numeric,
    COUNT(*)::bigint
  FROM public.orders o
  WHERE o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= ((p_start_date::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime <  ((p_end_date::timestamp + interval '1 day 4 hours') AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_revenue_from_orders(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(restaurant_id uuid, date date, platform text, revenue_ttc numeric, order_count bigint, average_basket numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '45s'
AS $function$
DECLARE
  v_ids uuid[];
  v_start timestamptz := ((p_start_date::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris');
  v_end timestamptz := ((p_end_date::timestamp + interval '1 day 4 hours') AT TIME ZONE 'Europe/Paris');
BEGIN
  SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.restaurants r
   WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
     AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));
  IF array_length(v_ids, 1) IS NULL THEN RETURN; END IF;

  IF (SELECT backfill_done FROM orders_daily_summary_state WHERE id = 1) THEN
    RETURN QUERY
    SELECT s.restaurant_id, s.day, 'uber_eats'::text, s.sales_incl_vat, s.order_count,
      CASE WHEN s.order_count > 0 THEN ROUND(s.sales_incl_vat / s.order_count, 2) ELSE 0 END
    FROM orders_daily_summary s
    WHERE s.restaurant_id = ANY(v_ids) AND s.day BETWEEN p_start_date AND p_end_date
    ORDER BY s.day;
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_restaurant AS (
    SELECT ids.restaurant_id AS agg_restaurant_id,
      ((ord.order_datetime AT TIME ZONE 'Europe/Paris') - interval '4 hours')::date AS agg_date,
      COALESCE(SUM(ord.sales_incl_vat), 0) AS agg_revenue_ttc,
      COUNT(ord.*)::bigint AS agg_order_count
    FROM unnest(v_ids) AS ids(restaurant_id)
    CROSS JOIN LATERAL (
      SELECT o.order_datetime, o.sales_incl_vat FROM public.orders o
      WHERE o.restaurant_id = ids.restaurant_id AND o.order_datetime >= v_start AND o.order_datetime < v_end
    ) ord
    GROUP BY 1, 2
  )
  SELECT p.agg_restaurant_id, p.agg_date, 'uber_eats'::text, p.agg_revenue_ttc, p.agg_order_count,
    CASE WHEN p.agg_order_count > 0 THEN ROUND(p.agg_revenue_ttc / p.agg_order_count, 2) ELSE 0 END
  FROM per_restaurant p ORDER BY p.agg_date;
END;
$function$;
