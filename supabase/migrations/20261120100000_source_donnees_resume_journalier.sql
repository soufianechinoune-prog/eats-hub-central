-- Vue d'ensemble, étape 3 : origine des commandes (API Uber / import CSV) et temps de préparation.
--
-- 1. Origine des commandes (badge API / CSV par restaurant)
--    Constat du 20/11/2026 : get_orders_data_source_breakdown relisait toutes les commandes de la période
--    (Chicken Street 2026 : > 60 s, abandon). Elle n'avait en plus aucun contrôle d'accès par enseigne.
--    → Résumé par restaurant, journée de service et origine, tenu à jour au même moment que
--      orders_daily_summary (ods_recompute_range est appelée par les déclencheurs sur orders et la nuit).
--    → La fonction lit ce résumé et vérifie l'accès à l'enseigne.
--
-- 2. Temps de préparation (get_network_prep_time_summary)
--    Le résumé journalier n'était utilisé que si la fin de période tombait pile sur minuit ou 23:59:59.
--    La Vue d'ensemble envoie « dernier jour clos à midi » en vue année/mois : la fonction relisait alors
--    tout l'historique détaillé (limite 10 s → « -- »). On utilise désormais toujours le résumé, jour par jour.

CREATE TABLE IF NOT EXISTS public.orders_source_daily_summary (
  restaurant_id uuid NOT NULL,
  day date NOT NULL,
  data_source text NOT NULL,
  order_count bigint NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, day, data_source)
);
ALTER TABLE public.orders_source_daily_summary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders_source_daily_summary FROM anon, authenticated;
GRANT ALL ON public.orders_source_daily_summary TO service_role;

CREATE OR REPLACE FUNCTION public.ods_source_recompute_range(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz := ((p_start::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris');
  v_end timestamptz := ((p_end::timestamp + interval '1 day 4 hours') AT TIME ZONE 'Europe/Paris');
  v_ids uuid[] := COALESCE(p_restaurant_ids, (SELECT array_agg(id) FROM restaurants));
BEGIN
  DELETE FROM orders_source_daily_summary s
   WHERE s.day BETWEEN p_start AND p_end AND s.restaurant_id = ANY(v_ids);
  INSERT INTO orders_source_daily_summary(restaurant_id, day, data_source, order_count, revenue, refreshed_at)
  SELECT ids.rid, ods_business_day(o.order_datetime), COALESCE(o.data_source, 'csv_import'),
    COUNT(*), COALESCE(SUM(o.gross_amount), 0), now()
  FROM unnest(v_ids) ids(rid)
  CROSS JOIN LATERAL (
    SELECT x.order_datetime, x.data_source, x.gross_amount
    FROM orders x WHERE x.restaurant_id = ids.rid AND x.order_datetime >= v_start AND x.order_datetime < v_end
  ) o
  GROUP BY 1, 2, 3;
END $function$;

-- Même corps qu'avant, plus la mise à jour du résumé par origine sur la même plage.
CREATE OR REPLACE FUNCTION public.ods_recompute_range(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  PERFORM ods_source_recompute_range(p_start, p_end, v_ids);
END $function$;

-- Remplissage initial (fait mois par mois le 20/11/2026, de 2023-01 à 2026-11) :
--   SELECT ods_source_recompute_range(m, (m + interval '1 month - 1 day')::date) FROM generate_series(...) m;

CREATE OR REPLACE FUNCTION public.get_orders_data_source_breakdown(p_restaurant_ids uuid[], p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(restaurant_id uuid, data_source text, order_count bigint, revenue numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '15s'
AS $function$
  -- Accès vérifié une fois par restaurant (et non une fois par ligne du résumé).
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
  )
  SELECT s.restaurant_id, s.data_source, SUM(s.order_count)::bigint, COALESCE(SUM(s.revenue), 0)::numeric
  FROM public.orders_source_daily_summary s
  WHERE s.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
    AND s.day BETWEEN (p_start_date AT TIME ZONE 'Europe/Paris')::date AND (p_end_date AT TIME ZONE 'Europe/Paris')::date
  GROUP BY s.restaurant_id, s.data_source;
$function$;

CREATE OR REPLACE FUNCTION public.get_network_prep_time_summary(p_restaurant_ids uuid[], p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(restaurant_id uuid, avg_prep_time numeric, avg_total_delivery_time numeric, avg_avoidable_wait_time numeric, prep_count bigint, delivery_count bigint, avoidable_wait_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '10s'
AS $function$
DECLARE
  v_s timestamp := p_start_date AT TIME ZONE 'Europe/Paris';
  v_e timestamp := p_end_date AT TIME ZONE 'Europe/Paris';
BEGIN
  IF (SELECT backfill_done FROM order_history_daily_summary_state WHERE id = 1) THEN
    -- Jours entiers : du jour de début au jour de fin (une fin pile à minuit exclut ce jour-là).
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
