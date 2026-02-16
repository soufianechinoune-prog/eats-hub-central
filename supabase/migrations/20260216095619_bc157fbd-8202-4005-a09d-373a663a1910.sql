
-- 1. Add eco_contribution_charge column
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS eco_contribution_charge NUMERIC DEFAULT 0;

-- 2. Drop and recreate RPC with new return type
DROP FUNCTION IF EXISTS public.get_monthly_payouts_detail(integer, integer, uuid[]);

CREATE OR REPLACE FUNCTION public.get_monthly_payouts_detail(
  p_year integer, 
  p_month integer, 
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
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
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.restaurant_id,
    p.payout_date,
    COALESCE(p.sales_incl_vat, 0),
    COALESCE(p.sales_excl_vat, 0),
    COALESCE(p.refund_incl_vat, 0),
    COALESCE(p.refund_excl_vat, 0),
    COALESCE(p.vat_refund, 0),
    COALESCE(p.item_promo_incl_vat, 0),
    COALESCE(p.item_promo_excl_vat, 0),
    COALESCE(p.uber_fee_after_promo_incl_vat, 0),
    COALESCE(p.uber_fee_after_promo_excl_vat, 0),
    COALESCE(p.uber_fee_before_promo_excl_vat, 0),
    COALESCE(p.uber_fee_promo_excl_vat, 0),
    COALESCE(p.vat_uber_fee, 0),
    COALESCE(p.delivery_promo_incl_vat, 0),
    COALESCE(p.delivery_promo_excl_vat, 0),
    COALESCE(p.price_adjustment_incl_vat, 0),
    COALESCE(p.price_adjustment_excl_vat, 0),
    COALESCE(p.other_payments_incl_vat, 0),
    COALESCE(p.net_payout, 0),
    COALESCE(p.order_count, 0)::INTEGER,
    COALESCE(p.tips, 0),
    COALESCE(p.marketing_fee_adjustment, 0),
    COALESCE(p.meal_voucher_amount, 0),
    COALESCE(p.eco_contribution_refund, 0),
    COALESCE(p.eco_contribution_charge, 0)
  FROM public.payouts p
  WHERE EXTRACT(YEAR FROM p.payout_date) = p_year
    AND EXTRACT(MONTH FROM p.payout_date) = p_month
    AND (p_restaurant_ids IS NULL OR p.restaurant_id = ANY(p_restaurant_ids))
  ORDER BY p.payout_date ASC, p.restaurant_id ASC;
END;
$function$;
