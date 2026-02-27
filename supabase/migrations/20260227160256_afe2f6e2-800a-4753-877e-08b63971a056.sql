CREATE OR REPLACE FUNCTION public.get_network_deliveroo_summary(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, total_revenue numeric, total_payable numeric, order_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.restaurant_id,
    COALESCE(SUM(d.order_amount), 0)::numeric AS total_revenue,
    COALESCE(SUM(d.total_payable), 0)::numeric AS total_payable,
    COUNT(*)::bigint AS order_count
  FROM public.deliveroo_orders d
  WHERE d.restaurant_id = ANY(p_restaurant_ids)
    AND d.history_type IN ('Livraison', 'À emporter', 'Nouvelle livraison')
    AND d.delivery_datetime >= p_start_date::timestamp
    AND d.delivery_datetime < (p_end_date + interval '1 day')::timestamp
  GROUP BY d.restaurant_id;
END;
$function$;