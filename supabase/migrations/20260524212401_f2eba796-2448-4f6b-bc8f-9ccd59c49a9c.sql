
CREATE OR REPLACE FUNCTION public.get_refund_orders_detail(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  order_id uuid,
  restaurant_id uuid,
  restaurant_name text,
  uber_order_id text,
  order_datetime timestamptz,
  refund_incl_vat numeric,
  refund_contested_incl_vat numeric,
  net_refund numeric,
  dispute_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id AS order_id,
    o.restaurant_id,
    r.name AS restaurant_name,
    o.uber_order_id,
    o.order_datetime,
    COALESCE(o.refund_incl_vat, 0) AS refund_incl_vat,
    COALESCE(o.refund_contested_incl_vat, 0) AS refund_contested_incl_vat,
    (COALESCE(o.refund_incl_vat, 0) + COALESCE(o.refund_contested_incl_vat, 0)) AS net_refund,
    o.dispute_status
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.restaurant_id = ANY(p_restaurant_ids)
    AND (o.order_datetime AT TIME ZONE 'Europe/Paris')::date BETWEEN p_start_date AND p_end_date
    AND (
      COALESCE(o.refund_incl_vat, 0) <> 0
      OR COALESCE(o.refund_contested_incl_vat, 0) <> 0
    )
  ORDER BY o.order_datetime DESC
$$;

ALTER FUNCTION public.get_refund_orders_detail(uuid[], date, date) SET statement_timeout TO '30s';

GRANT EXECUTE ON FUNCTION public.get_refund_orders_detail(uuid[], date, date) TO authenticated;
