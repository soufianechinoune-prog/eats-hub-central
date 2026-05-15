CREATE OR REPLACE FUNCTION public.get_network_orders_summary(
  p_restaurant_ids uuid[], p_start_date date, p_end_date date
)
RETURNS TABLE(
  restaurant_id uuid,
  total_sales_incl_vat numeric,
  total_net_payout numeric,
  total_item_promo_incl_vat numeric,
  total_meal_voucher numeric,
  order_count bigint
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
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
    AND o.order_datetime >= p_start_date::timestamp
    AND o.order_datetime < (p_end_date + interval '1 day')::timestamp
  GROUP BY o.restaurant_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_network_orders_summary(uuid[], date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_network_orders_summary(uuid[], date, date) TO authenticated;