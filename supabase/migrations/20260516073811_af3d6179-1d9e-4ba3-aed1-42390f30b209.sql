CREATE OR REPLACE FUNCTION public.get_orders_commission_by_fulfillment(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  day date,
  restaurant_id uuid,
  channel text,
  order_count bigint,
  sales_incl_vat numeric,
  item_promo_incl_vat numeric,
  uber_fee_before_promo_excl_vat numeric,
  uber_fee_after_promo_excl_vat numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (o.order_datetime AT TIME ZONE 'Europe/Paris')::date AS day,
    o.restaurant_id,
    CASE
      WHEN o.fulfillment_type ILIKE '%emport%' THEN 'takeaway'
      WHEN o.fulfillment_type ILIKE '%livraison%' OR o.fulfillment_type ILIKE '%delivery%' THEN 'delivery'
      ELSE 'other'
    END AS channel,
    COUNT(*)::bigint AS order_count,
    COALESCE(SUM(ABS(o.sales_incl_vat)), 0)::numeric AS sales_incl_vat,
    COALESCE(SUM(ABS(o.item_promo_incl_vat)), 0)::numeric AS item_promo_incl_vat,
    COALESCE(SUM(ABS(o.uber_fee_before_promo_excl_vat)), 0)::numeric AS uber_fee_before_promo_excl_vat,
    COALESCE(SUM(ABS(o.uber_fee_after_promo_excl_vat)), 0)::numeric AS uber_fee_after_promo_excl_vat
  FROM public.orders o
  WHERE o.restaurant_id = ANY(p_restaurant_ids)
    AND (o.order_datetime AT TIME ZONE 'Europe/Paris')::date BETWEEN p_start_date AND p_end_date
  GROUP BY 1, 2, 3;
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_commission_by_fulfillment(uuid[], date, date) TO authenticated;