-- CA mensuel (Revenus & Ventes, vue année) : lecture du résumé journalier.
--
-- Constat du 20/11/2026 (Chicken Street, année 2026) :
-- 1. Lenteur : la fonction relisait chaque commande de l'année (~1 M) et le double pour la comparaison 2025 ;
--    la page affichait parfois « Aucune donnée » le temps du calcul ou en cas d'abandon.
-- 2. Une ligne par restaurant et par mois (103 × 11 = 1 133 lignes) sans ordre : au-delà de 1 000 lignes,
--    des mois disparaissaient au hasard. La page lit maintenant par paquets ; l'ordre (mois, restaurant)
--    rend ces paquets stables.
-- 3. Même journée que le CA journalier : journée de service de Paris (coupure à 4 h, ods_business_day).
-- Repli sur les commandes si le résumé n'est pas prêt.

CREATE OR REPLACE FUNCTION public.get_monthly_revenue_from_orders(p_year integer, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(restaurant_id uuid, year integer, month integer, platform text, revenue_ttc numeric, order_count bigint, average_basket numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '45s'
AS $function$
DECLARE
  v_ids uuid[];
  v_first date := make_date(p_year, 1, 1);
  v_last date := make_date(p_year, 12, 31);
BEGIN
  SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.restaurants r
   WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
     AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF (SELECT backfill_done FROM orders_daily_summary_state WHERE id = 1) THEN
    RETURN QUERY
    SELECT s.restaurant_id, p_year, EXTRACT(MONTH FROM s.day)::int, 'uber_eats'::text,
      COALESCE(SUM(s.sales_incl_vat), 0)::numeric,
      COALESCE(SUM(s.order_count), 0)::bigint,
      CASE WHEN COALESCE(SUM(s.order_count), 0) > 0
        THEN ROUND(SUM(s.sales_incl_vat) / SUM(s.order_count), 2) ELSE 0 END
    FROM orders_daily_summary s
    WHERE s.restaurant_id = ANY(v_ids) AND s.day BETWEEN v_first AND v_last
    GROUP BY s.restaurant_id, EXTRACT(MONTH FROM s.day)
    ORDER BY 3, 1;
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_restaurant AS (
    SELECT
      ids.restaurant_id AS agg_restaurant_id,
      EXTRACT(MONTH FROM public.ods_business_day(ord.order_datetime))::int AS agg_month,
      COALESCE(SUM(ord.sales_incl_vat), 0) AS agg_revenue_ttc,
      COUNT(ord.*)::bigint AS agg_order_count
    FROM unnest(v_ids) AS ids(restaurant_id)
    CROSS JOIN LATERAL (
      SELECT o.order_datetime, o.sales_incl_vat
      FROM public.orders o
      WHERE o.restaurant_id = ids.restaurant_id
        AND o.order_datetime >= ((v_first::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris')
        AND o.order_datetime < (((v_last + 1)::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris')
    ) ord
    GROUP BY 1, 2
  )
  SELECT p.agg_restaurant_id, p_year, p.agg_month, 'uber_eats'::text, p.agg_revenue_ttc, p.agg_order_count,
    CASE WHEN p.agg_order_count > 0 THEN ROUND(p.agg_revenue_ttc / p.agg_order_count, 2) ELSE 0 END
  FROM per_restaurant p
  ORDER BY p.agg_month, p.agg_restaurant_id;
END;
$function$;
