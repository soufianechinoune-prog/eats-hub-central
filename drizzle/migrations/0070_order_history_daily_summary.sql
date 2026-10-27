-- lovable-cron-fallback-reviewed: one-time history backfill, one month per minute, job unschedules itself when finished
CREATE TABLE public.order_history_daily_summary (
  restaurant_id uuid NOT NULL,
  day date NOT NULL,
  prep_sum numeric NOT NULL DEFAULT 0, prep_count bigint NOT NULL DEFAULT 0,
  delivery_sum numeric NOT NULL DEFAULT 0, delivery_count bigint NOT NULL DEFAULT 0,
  wait_sum numeric NOT NULL DEFAULT 0, wait_count bigint NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, day)
);
CREATE INDEX idx_ohds_day ON public.order_history_daily_summary(day);
GRANT ALL ON public.order_history_daily_summary TO service_role;
ALTER TABLE public.order_history_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_history_daily_summary_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  backfill_cursor date NOT NULL DEFAULT date '2020-01-01',
  backfill_done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.order_history_daily_summary_state TO service_role;
ALTER TABLE public.order_history_daily_summary_state ENABLE ROW LEVEL SECURITY;
INSERT INTO public.order_history_daily_summary_state(id) VALUES (1);

CREATE OR REPLACE FUNCTION public.ohds_recompute_range(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start timestamptz := (p_start::timestamp AT TIME ZONE 'Europe/Paris');
  v_end timestamptz := ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris');
  v_ids uuid[] := COALESCE(p_restaurant_ids, (SELECT array_agg(id) FROM restaurants));
BEGIN
  DELETE FROM order_history_daily_summary s WHERE s.day BETWEEN p_start AND p_end AND s.restaurant_id = ANY(v_ids);
  INSERT INTO order_history_daily_summary(restaurant_id, day, prep_sum, prep_count, delivery_sum, delivery_count, wait_sum, wait_count, refreshed_at)
  SELECT ids.rid, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date,
    COALESCE(SUM(o.initial_prep_time_minutes),0), COUNT(o.initial_prep_time_minutes),
    COALESCE(SUM(o.total_prep_delivery_time_minutes),0), COUNT(o.total_prep_delivery_time_minutes),
    COALESCE(SUM(o.avoidable_wait_time_minutes),0), COUNT(o.avoidable_wait_time_minutes), now()
  FROM unnest(v_ids) ids(rid)
  CROSS JOIN LATERAL (
    SELECT x.order_datetime, x.initial_prep_time_minutes, x.total_prep_delivery_time_minutes, x.avoidable_wait_time_minutes
    FROM order_history x WHERE x.restaurant_id = ids.rid AND x.order_datetime >= v_start AND x.order_datetime < v_end
  ) o
  GROUP BY 1, 2;
END $$;
REVOKE ALL ON FUNCTION public.ohds_recompute_range(date,date,uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ohds_recompute_pairs(p_pairs jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT (e->>'d')::date AS day, array_agg(DISTINCT (e->>'r')::uuid) AS ids FROM jsonb_array_elements(p_pairs) e GROUP BY 1 LOOP
    PERFORM ohds_recompute_range(r.day, r.day, r.ids);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.ohds_recompute_pairs(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ohds_trg_new() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM ohds_recompute_pairs(COALESCE((SELECT jsonb_agg(jsonb_build_object('r', restaurant_id, 'd', d)) FROM
    (SELECT DISTINCT restaurant_id, (order_datetime AT TIME ZONE 'Europe/Paris')::date d FROM new_rows WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL) x), '[]'));
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.ohds_trg_old() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM ohds_recompute_pairs(COALESCE((SELECT jsonb_agg(jsonb_build_object('r', restaurant_id, 'd', d)) FROM
    (SELECT DISTINCT restaurant_id, (order_datetime AT TIME ZONE 'Europe/Paris')::date d FROM old_rows WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL) x), '[]'));
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.ohds_trg_upd() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM ohds_recompute_pairs(COALESCE((SELECT jsonb_agg(jsonb_build_object('r', restaurant_id, 'd', d)) FROM
    (SELECT restaurant_id, (order_datetime AT TIME ZONE 'Europe/Paris')::date d FROM new_rows WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL
     UNION
     SELECT restaurant_id, (order_datetime AT TIME ZONE 'Europe/Paris')::date d FROM old_rows WHERE restaurant_id IS NOT NULL AND order_datetime IS NOT NULL) x), '[]'));
  RETURN NULL;
END $$;
CREATE TRIGGER trg_ohds_ins AFTER INSERT ON public.order_history REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.ohds_trg_new();
CREATE TRIGGER trg_ohds_del AFTER DELETE ON public.order_history REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.ohds_trg_old();
CREATE TRIGGER trg_ohds_upd AFTER UPDATE ON public.order_history REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.ohds_trg_upd();

CREATE OR REPLACE FUNCTION public.ohds_backfill_step()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '55s' AS $$
DECLARE v_state record; v_month_end date;
BEGIN
  SELECT * INTO v_state FROM order_history_daily_summary_state WHERE id = 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN 'busy'; END IF;
  IF v_state.backfill_done THEN PERFORM cron.unschedule('ohds-backfill'); RETURN 'done'; END IF;
  v_month_end := (date_trunc('month', v_state.backfill_cursor) + interval '1 month - 1 day')::date;
  PERFORM ohds_recompute_range(v_state.backfill_cursor, v_month_end, NULL);
  UPDATE order_history_daily_summary_state
     SET backfill_cursor = v_month_end + 1,
         backfill_done = (v_month_end >= (now() AT TIME ZONE 'Europe/Paris')::date),
         updated_at = now()
   WHERE id = 1;
  RETURN v_month_end::text;
END $$;
REVOKE ALL ON FUNCTION public.ohds_backfill_step() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ohds_nightly()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '600s' AS $$
DECLARE d date := (now() AT TIME ZONE 'Europe/Paris')::date - 60;
BEGIN
  WHILE d <= (now() AT TIME ZONE 'Europe/Paris')::date LOOP
    PERFORM ohds_recompute_range(d, d + 6, NULL);
    d := d + 7;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.ohds_nightly() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('ohds-backfill', '* * * * *', 'SELECT public.ohds_backfill_step()');
SELECT cron.schedule('ohds-nightly', '30 3 * * *', 'SELECT public.ohds_nightly()');

-- Read path: summary only when the backfill is done AND the range is whole Paris days; otherwise raw rows
CREATE OR REPLACE FUNCTION public.get_network_prep_time_summary(p_restaurant_ids uuid[], p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(restaurant_id uuid, avg_prep_time numeric, avg_total_delivery_time numeric, avg_avoidable_wait_time numeric, prep_count bigint, delivery_count bigint, avoidable_wait_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '10s'
AS $function$
DECLARE
  v_s timestamp := p_start_date AT TIME ZONE 'Europe/Paris';
  v_e timestamp := p_end_date AT TIME ZONE 'Europe/Paris';
BEGIN
  IF (SELECT backfill_done FROM order_history_daily_summary_state WHERE id = 1)
     AND v_s = date_trunc('day', v_s)
     AND (v_e = date_trunc('day', v_e) OR v_e >= date_trunc('day', v_e) + interval '23 hours 59 minutes 59 seconds') THEN
    RETURN QUERY
    SELECT s.restaurant_id,
      ROUND(SUM(s.prep_sum) / NULLIF(SUM(s.prep_count),0), 2),
      ROUND(SUM(s.delivery_sum) / NULLIF(SUM(s.delivery_count),0), 2),
      ROUND(SUM(s.wait_sum) / NULLIF(SUM(s.wait_count),0), 2),
      SUM(s.prep_count)::bigint, SUM(s.delivery_count)::bigint, SUM(s.wait_count)::bigint
    FROM order_history_daily_summary s
    WHERE s.restaurant_id = ANY(p_restaurant_ids)
      AND s.day BETWEEN v_s::date AND (CASE WHEN v_e = date_trunc('day', v_e) AND v_e > v_s THEN v_e::date - 1 ELSE v_e::date END)
    GROUP BY s.restaurant_id;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT oh.restaurant_id,
    ROUND(AVG(oh.initial_prep_time_minutes), 2),
    ROUND(AVG(oh.total_prep_delivery_time_minutes), 2),
    ROUND(AVG(oh.avoidable_wait_time_minutes), 2),
    COUNT(oh.initial_prep_time_minutes)::bigint,
    COUNT(oh.total_prep_delivery_time_minutes)::bigint,
    COUNT(oh.avoidable_wait_time_minutes)::bigint
  FROM public.order_history oh
  WHERE oh.restaurant_id = ANY(p_restaurant_ids)
    AND oh.order_datetime >= p_start_date AND oh.order_datetime <= p_end_date
  GROUP BY oh.restaurant_id;
END;
$function$;