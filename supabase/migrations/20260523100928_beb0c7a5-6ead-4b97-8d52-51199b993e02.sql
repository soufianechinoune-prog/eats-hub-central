CREATE OR REPLACE FUNCTION public.get_refunded_orders_count(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
) RETURNS TABLE(restaurant_id uuid, refunded_orders bigint, total_orders bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.restaurant_id,
    COUNT(*) FILTER (WHERE COALESCE(o.refund_incl_vat, 0) <> 0)::bigint AS refunded_orders,
    COUNT(*)::bigint AS total_orders
  FROM public.orders o
  WHERE o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime <  ((p_end_date + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id;
$$;