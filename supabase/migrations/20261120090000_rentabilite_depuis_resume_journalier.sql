-- Rentabilité globale (Revenus & Ventes) : lecture du résumé journalier, journée de service de Paris.
--
-- Constat du 20/11/2026 (Chicken Street, novembre) :
-- 1. Lenteur : les deux fonctions relisaient les commandes une à une (79 000 en novembre, ~1 M sur un an),
--    alors que orders_daily_summary contient déjà les mêmes sommes par restaurant et par jour.
-- 2. Journée coupée à minuit UTC, alors que le CA (get_daily_revenue_from_orders) utilise la journée de
--    service de Paris (ods_business_day : coupure à 4 h). Les deux graphiques comptent désormais les mêmes
--    commandes.
-- 3. Ordre stable (jour, restaurant) : la page lit les lignes par paquets de 1 000.
--
-- Mêmes colonnes en sortie. « sales » = somme des ventes positives (sales_incl_vat_pos) : identique à
-- l'ancienne SUM(ABS(...)) tant qu'aucune vente n'est négative (0 ligne négative en oct. 2026 sur CS).
-- Si le résumé n'est pas prêt (backfill_done = false), on relit les commandes avec la même journée.

CREATE OR REPLACE FUNCTION public.get_profitability_daily(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, day date, sales numeric, payout numeric, net_payout numeric, meal_voucher numeric, orders_count bigint, item_promo_incl_vat numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '45s'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF array_length(p_restaurant_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF (p_end_date - p_start_date) > 400 THEN
    RAISE EXCEPTION 'Date range cannot exceed 400 days';
  END IF;

  IF public.is_super_admin() THEN
    v_ids := p_restaurant_ids;
  ELSE
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE public.user_has_chain_access(r.chain_id)
       AND r.id = ANY(p_restaurant_ids);
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF (SELECT backfill_done FROM orders_daily_summary_state WHERE id = 1) THEN
    RETURN QUERY
    SELECT s.restaurant_id, s.day,
      COALESCE(s.sales_incl_vat_pos, 0)::numeric,
      (COALESCE(s.net_payout, 0) + COALESCE(s.meal_voucher, 0))::numeric,
      COALESCE(s.net_payout, 0)::numeric,
      COALESCE(s.meal_voucher, 0)::numeric,
      COALESCE(s.order_count, 0)::bigint,
      COALESCE(s.item_promo_incl_vat_abs, 0)::numeric
    FROM orders_daily_summary s
    WHERE s.restaurant_id = ANY(v_ids) AND s.day BETWEEN p_start_date AND p_end_date
    ORDER BY s.day, s.restaurant_id;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.restaurant_id,
    public.ods_business_day(o.order_datetime) AS day,
    COALESCE(SUM(ABS(o.sales_incl_vat)), 0)::numeric,
    COALESCE(SUM(o.net_payout + COALESCE(o.meal_voucher_amount, 0)), 0)::numeric,
    COALESCE(SUM(o.net_payout), 0)::numeric,
    COALESCE(SUM(COALESCE(o.meal_voucher_amount, 0)), 0)::numeric,
    COUNT(*)::bigint,
    COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat, 0))), 0)::numeric
  FROM unnest(v_ids) AS ids(restaurant_id)
  JOIN public.orders o ON o.restaurant_id = ids.restaurant_id
  WHERE o.order_datetime >= ((p_start_date::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime < ((p_end_date::timestamp + interval '1 day 4 hours') AT TIME ZONE 'Europe/Paris')
  GROUP BY 1, 2
  ORDER BY 2, 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_profitability_monthly(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, day date, sales numeric, payout numeric, net_payout numeric, meal_voucher numeric, orders_count bigint, item_promo_incl_vat numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_restaurant_ids IS NULL OR array_length(p_restaurant_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF public.is_super_admin() THEN
    v_ids := p_restaurant_ids;
  ELSE
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE public.user_has_chain_access(r.chain_id)
       AND r.id = ANY(p_restaurant_ids);
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF (SELECT backfill_done FROM orders_daily_summary_state WHERE id = 1) THEN
    RETURN QUERY
    SELECT s.restaurant_id, date_trunc('month', s.day)::date,
      COALESCE(SUM(s.sales_incl_vat_pos), 0)::numeric,
      COALESCE(SUM(COALESCE(s.net_payout, 0) + COALESCE(s.meal_voucher, 0)), 0)::numeric,
      COALESCE(SUM(s.net_payout), 0)::numeric,
      COALESCE(SUM(s.meal_voucher), 0)::numeric,
      COALESCE(SUM(s.order_count), 0)::bigint,
      COALESCE(SUM(s.item_promo_incl_vat_abs), 0)::numeric
    FROM orders_daily_summary s
    WHERE s.restaurant_id = ANY(v_ids) AND s.day BETWEEN p_start_date AND p_end_date
    GROUP BY 1, 2
    ORDER BY 2, 1;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.restaurant_id,
    date_trunc('month', public.ods_business_day(o.order_datetime))::date AS day,
    COALESCE(SUM(ABS(o.sales_incl_vat)), 0)::numeric,
    COALESCE(SUM(o.net_payout + COALESCE(o.meal_voucher_amount, 0)), 0)::numeric,
    COALESCE(SUM(o.net_payout), 0)::numeric,
    COALESCE(SUM(COALESCE(o.meal_voucher_amount, 0)), 0)::numeric,
    COUNT(*)::bigint,
    COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat, 0))), 0)::numeric
  FROM unnest(v_ids) AS ids(restaurant_id)
  JOIN public.orders o ON o.restaurant_id = ids.restaurant_id
  WHERE o.order_datetime >= ((p_start_date::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime < ((p_end_date::timestamp + interval '1 day 4 hours') AT TIME ZONE 'Europe/Paris')
  GROUP BY 1, 2
  ORDER BY 2, 1;
END;
$function$;
