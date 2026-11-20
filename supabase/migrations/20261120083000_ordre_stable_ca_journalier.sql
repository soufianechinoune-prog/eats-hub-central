-- CA journalier : ordre stable (date, puis restaurant).
--
-- Pourquoi : ces fonctions renvoient une ligne par restaurant et par jour. L'API ne rend que 1 000 lignes
-- par appel, donc la page les lit par paquets (.range). Triées par date seulement, les lignes d'un même jour
-- peuvent changer d'ordre d'un appel à l'autre : une ligne peut alors sortir deux fois ou pas du tout.
-- Constat du 20/11/2026 : Revenus & Ventes Chicken Street, octobre 2026 = 3 190 lignes, seuls les 1er-10
-- s'affichaient. Le corps des fonctions est identique ; seul l'ORDER BY change.

CREATE OR REPLACE FUNCTION public.get_daily_revenue_from_orders(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(restaurant_id uuid, date date, platform text, revenue_ttc numeric, order_count bigint, average_basket numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '45s'
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
    ORDER BY s.day, s.restaurant_id;
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
  FROM per_restaurant p ORDER BY p.agg_date, p.agg_restaurant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_onsite_from_splash(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(restaurant_id uuid, date date, revenue_ttc numeric, order_count bigint, average_basket numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  SELECT s.restaurant_id, s.date,
    COALESCE(SUM(s.revenue_ttc) FILTER (WHERE s.platform='global'),0)::numeric,
    COALESCE(SUM(s.order_count) FILTER (WHERE s.platform='global'),0)::bigint,
    CASE WHEN COALESCE(SUM(s.order_count) FILTER (WHERE s.platform='global'),0)>0
      THEN ROUND(SUM(s.revenue_ttc) FILTER (WHERE s.platform='global')::numeric
                 / SUM(s.order_count) FILTER (WHERE s.platform='global'),2)
      ELSE 0 END
  FROM public.splash360_daily_sales s
  JOIN public.restaurants r ON r.id = s.restaurant_id
  WHERE s.granularity='day' AND s.restaurant_splash_id<>0 AND s.restaurant_id IS NOT NULL
    AND s.date BETWEEN p_start_date AND p_end_date
    AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
    AND (p_restaurant_ids IS NULL OR s.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY s.restaurant_id, s.date
  ORDER BY s.date, s.restaurant_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_chataigne(p_start_date date, p_end_date date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(restaurant_id uuid, date date, revenue_ttc numeric, order_count bigint, average_basket numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  SELECT a.restaurant_id, a.date,
    COALESCE(SUM(a.gross_order_value),0)::numeric,
    COALESCE(SUM(a.order_count),0)::bigint,
    CASE WHEN COALESCE(SUM(a.order_count),0)>0
      THEN ROUND(COALESCE(SUM(a.gross_order_value),0)::numeric / SUM(a.order_count),2)
      ELSE 0 END
  FROM public.chataigne_daily_analytics a
  WHERE a.date BETWEEN p_start_date AND p_end_date
    AND (public.is_super_admin() OR public.user_has_chain_access(a.chain_id))
    AND (p_restaurant_ids IS NULL OR a.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY a.restaurant_id, a.date
  ORDER BY a.date, a.restaurant_id;
$function$;
