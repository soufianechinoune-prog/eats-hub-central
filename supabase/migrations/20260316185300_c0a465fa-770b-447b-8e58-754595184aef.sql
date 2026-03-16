CREATE OR REPLACE FUNCTION public.get_network_deliveroo_summary(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, total_revenue numeric, total_payable numeric, order_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
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
      AND d.delivery_datetime >= p_start_date::timestamp
      AND d.delivery_datetime < (p_end_date + interval '1 day')::timestamp
    GROUP BY d.restaurant_id
  ),
  payout_data AS (
    SELECT
      d.restaurant_id,
      COALESCE(SUM(d.total_payable), 0)::numeric AS total_payable
    FROM public.deliveroo_orders d
    WHERE d.restaurant_id = ANY(p_restaurant_ids)
      AND d.delivery_datetime >= p_start_date::timestamp
      AND d.delivery_datetime < (p_end_date + interval '1 day')::timestamp
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