-- Monthly summary based on orders (same shape as get_monthly_payouts_summary)
CREATE OR REPLACE FUNCTION public.get_orders_finance_summary(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  restaurant_id uuid,
  month integer,
  year integer,
  sales_incl_vat numeric,
  refund_incl_vat numeric,
  item_promo_incl_vat numeric,
  uber_fee_incl_vat numeric,
  delivery_promo_incl_vat numeric,
  other_payments_incl_vat numeric,
  net_payout numeric,
  order_count bigint,
  tips numeric,
  marketing_fee_adjustment numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.restaurant_id,
    EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS month,
    p_year AS year,
    COALESCE(SUM(o.sales_incl_vat), 0) AS sales_incl_vat,
    COALESCE(SUM(o.refund_incl_vat), 0) AS refund_incl_vat,
    COALESCE(SUM(o.item_promo_incl_vat), 0) AS item_promo_incl_vat,
    COALESCE(SUM(o.uber_fee_after_promo_incl_vat), 0) AS uber_fee_incl_vat,
    COALESCE(SUM(o.delivery_promo_incl_vat), 0) AS delivery_promo_incl_vat,
    COALESCE(SUM(o.other_payments_incl_vat), 0) AS other_payments_incl_vat,
    COALESCE(SUM(o.net_payout), 0) AS net_payout,
    COUNT(*)::bigint AS order_count,
    COALESCE(SUM(o.tip_amount), 0) AS tips,
    COALESCE(SUM(o.marketing_fee_adjustment), 0) AS marketing_fee_adjustment
  FROM public.orders o
  WHERE o.order_datetime >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND o.order_datetime <  make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    AND (
      public.is_super_admin()
      OR o.restaurant_id IN (
        SELECT r.id FROM public.restaurants r
        WHERE public.user_has_chain_access(r.chain_id)
      )
    )
  GROUP BY o.restaurant_id, EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'));
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_finance_summary(integer, uuid[]) TO authenticated;

-- Monthly detail based on orders (same shape as get_monthly_payouts_detail)
CREATE OR REPLACE FUNCTION public.get_orders_finance_detail(
  p_year integer,
  p_month integer,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  restaurant_id uuid,
  payout_date date,
  sales_incl_vat numeric,
  sales_excl_vat numeric,
  refund_incl_vat numeric,
  refund_excl_vat numeric,
  vat_refund numeric,
  item_promo_incl_vat numeric,
  item_promo_excl_vat numeric,
  uber_fee_after_promo_incl_vat numeric,
  uber_fee_after_promo_excl_vat numeric,
  uber_fee_before_promo_excl_vat numeric,
  uber_fee_promo_excl_vat numeric,
  vat_uber_fee numeric,
  delivery_promo_incl_vat numeric,
  delivery_promo_excl_vat numeric,
  price_adjustment_incl_vat numeric,
  price_adjustment_excl_vat numeric,
  other_payments_incl_vat numeric,
  net_payout numeric,
  order_count integer,
  tips numeric,
  marketing_fee_adjustment numeric,
  meal_voucher_amount numeric,
  eco_contribution_refund numeric,
  eco_contribution_charge numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.restaurant_id,
    ((o.order_datetime AT TIME ZONE 'Europe/Paris')::date) AS payout_date,
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
  WHERE o.order_datetime >= make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Europe/Paris')
    AND o.order_datetime <  (make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Europe/Paris') + interval '1 month')
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    AND (
      public.is_super_admin()
      OR o.restaurant_id IN (
        SELECT r.id FROM public.restaurants r
        WHERE public.user_has_chain_access(r.chain_id)
      )
    )
  GROUP BY o.restaurant_id, ((o.order_datetime AT TIME ZONE 'Europe/Paris')::date);
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_finance_detail(integer, integer, uuid[]) TO authenticated;

-- Yearly detail based on orders (same shape as get_yearly_payouts_detail)
CREATE OR REPLACE FUNCTION public.get_orders_finance_yearly_detail(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  restaurant_id uuid,
  payout_date date,
  sales_incl_vat numeric,
  sales_excl_vat numeric,
  refund_incl_vat numeric,
  refund_excl_vat numeric,
  vat_refund numeric,
  item_promo_incl_vat numeric,
  item_promo_excl_vat numeric,
  uber_fee_after_promo_incl_vat numeric,
  uber_fee_after_promo_excl_vat numeric,
  uber_fee_before_promo_excl_vat numeric,
  uber_fee_promo_excl_vat numeric,
  vat_uber_fee numeric,
  delivery_promo_incl_vat numeric,
  delivery_promo_excl_vat numeric,
  price_adjustment_incl_vat numeric,
  price_adjustment_excl_vat numeric,
  other_payments_incl_vat numeric,
  net_payout numeric,
  order_count integer,
  tips numeric,
  marketing_fee_adjustment numeric,
  meal_voucher_amount numeric,
  eco_contribution_refund numeric,
  eco_contribution_charge numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.restaurant_id,
    ((o.order_datetime AT TIME ZONE 'Europe/Paris')::date) AS payout_date,
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
  WHERE o.order_datetime >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND o.order_datetime <  make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    AND (
      public.is_super_admin()
      OR o.restaurant_id IN (
        SELECT r.id FROM public.restaurants r
        WHERE public.user_has_chain_access(r.chain_id)
      )
    )
  GROUP BY o.restaurant_id, ((o.order_datetime AT TIME ZONE 'Europe/Paris')::date);
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_finance_yearly_detail(integer, uuid[]) TO authenticated;