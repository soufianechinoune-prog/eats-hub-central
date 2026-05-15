CREATE OR REPLACE FUNCTION public.get_network_orders_summary(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, total_sales_incl_vat numeric, total_net_payout numeric, total_item_promo_incl_vat numeric, total_meal_voucher numeric, order_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '10s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    o.restaurant_id,
    COALESCE(SUM(GREATEST(o.sales_incl_vat, 0)), 0)::numeric AS total_sales_incl_vat,
    COALESCE(SUM(o.net_payout), 0)::numeric AS total_net_payout,
    COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat, 0))), 0)::numeric AS total_item_promo_incl_vat,
    COALESCE(SUM(COALESCE(o.meal_voucher_amount, 0)), 0)::numeric AS total_meal_voucher,
    COUNT(*)::bigint AS order_count
  FROM public.orders o
  WHERE o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_network_deliveroo_summary(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, total_revenue numeric, total_payable numeric, order_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '10s'
AS $function$
BEGIN
  RETURN QUERY
  WITH revenue_data AS (
    SELECT
      d.restaurant_id,
      COALESCE(SUM(d.order_amount), 0)::numeric AS total_revenue,
      COUNT(*)::bigint AS order_count
    FROM public.deliveroo_orders d
    WHERE d.restaurant_id = ANY(p_restaurant_ids)
      AND d.history_type IN ('Livraison', 'À emporter', 'Nouvelle livraison')
      AND d.delivery_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
      AND d.delivery_datetime <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
    GROUP BY d.restaurant_id
  ),
  payout_data AS (
    SELECT
      d.restaurant_id,
      COALESCE(SUM(d.total_payable), 0)::numeric AS total_payable
    FROM public.deliveroo_orders d
    WHERE d.restaurant_id = ANY(p_restaurant_ids)
      AND d.delivery_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
      AND d.delivery_datetime <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
      AND d.history_type NOT IN ('Facture précédente: Livraison', 'Facture précédente: Remboursement client')
    GROUP BY d.restaurant_id
  )
  SELECT
    COALESCE(r.restaurant_id, p.restaurant_id) AS restaurant_id,
    COALESCE(r.total_revenue, 0) AS total_revenue,
    COALESCE(p.total_payable, 0) AS total_payable,
    COALESCE(r.order_count, 0) AS order_count
  FROM revenue_data r
  FULL OUTER JOIN payout_data p ON r.restaurant_id = p.restaurant_id;
END;
$function$;