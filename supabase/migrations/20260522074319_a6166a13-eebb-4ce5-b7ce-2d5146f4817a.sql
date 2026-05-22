CREATE OR REPLACE FUNCTION public.get_orders_finance_detail(p_year integer, p_month integer, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(restaurant_id uuid, payout_date date, sales_incl_vat numeric, sales_excl_vat numeric, refund_incl_vat numeric, refund_excl_vat numeric, vat_refund numeric, item_promo_incl_vat numeric, item_promo_excl_vat numeric, uber_fee_after_promo_incl_vat numeric, uber_fee_after_promo_excl_vat numeric, uber_fee_before_promo_excl_vat numeric, uber_fee_promo_excl_vat numeric, vat_uber_fee numeric, delivery_promo_incl_vat numeric, delivery_promo_excl_vat numeric, price_adjustment_incl_vat numeric, price_adjustment_excl_vat numeric, other_payments_incl_vat numeric, net_payout numeric, order_count integer, tips numeric, marketing_fee_adjustment numeric, meal_voucher_amount numeric, eco_contribution_refund numeric, eco_contribution_charge numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    o.restaurant_id,
    ((o.order_datetime AT TIME ZONE 'UTC')::date) AS payout_date,
    COALESCE(SUM(o.sales_incl_vat), 0),
    COALESCE(SUM(o.sales_excl_vat), 0),
    COALESCE(SUM(o.refund_incl_vat), 0),
    COALESCE(SUM(o.refund_excl_vat), 0),
    COALESCE(SUM(COALESCE(o.vat_1_refund,0) + COALESCE(o.vat_2_refund,0) + COALESCE(o.vat_3_refund,0)), 0),
    COALESCE(SUM(o.item_promo_incl_vat), 0),
    COALESCE(SUM(o.item_promo_excl_vat), 0),
    COALESCE(SUM(o.uber_fee_after_promo_incl_vat), 0),
    COALESCE(SUM(o.uber_fee_after_promo_excl_vat), 0),
    COALESCE(SUM(o.uber_fee_before_promo_excl_vat), 0),
    COALESCE(SUM(o.uber_fee_promo_excl_vat), 0),
    COALESCE(SUM(o.vat_uber_fee), 0),
    COALESCE(SUM(o.delivery_promo_incl_vat), 0),
    COALESCE(SUM(o.delivery_promo_excl_vat), 0),
    COALESCE(SUM(o.price_adjustment_incl_vat), 0),
    COALESCE(SUM(o.price_adjustment_excl_vat), 0),
    COALESCE(SUM(o.other_payments_incl_vat), 0),
    COALESCE(SUM(o.net_payout), 0),
    COUNT(*)::int,
    COALESCE(SUM(o.tip_amount), 0),
    COALESCE(SUM(o.marketing_fee_adjustment), 0),
    COALESCE(SUM(o.meal_voucher_amount), 0),
    COALESCE(SUM(GREATEST(o.eco_contribution_refund, 0)), 0),
    COALESCE(SUM(LEAST(o.eco_contribution_refund, 0)), 0)
  FROM public.orders o
  WHERE o.order_datetime >= make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC')
    AND o.order_datetime <  (make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC') + interval '1 month')
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    AND (
      public.is_super_admin()
      OR o.restaurant_id IN (
        SELECT r.id FROM public.restaurants r
        WHERE public.user_has_chain_access(r.chain_id)
      )
    )
  GROUP BY o.restaurant_id, ((o.order_datetime AT TIME ZONE 'UTC')::date)
  ORDER BY o.restaurant_id, ((o.order_datetime AT TIME ZONE 'UTC')::date);
$function$;