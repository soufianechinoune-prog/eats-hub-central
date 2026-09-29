CREATE OR REPLACE FUNCTION public.get_network_orders_summary(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, total_sales_incl_vat numeric, total_net_payout numeric, total_item_promo_incl_vat numeric, total_meal_voucher numeric, order_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '10s'
AS $function$
BEGIN
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