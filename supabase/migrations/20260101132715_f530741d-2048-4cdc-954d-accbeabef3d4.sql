
-- Drop and recreate the function with the new return type
DROP FUNCTION IF EXISTS public.get_monthly_payouts_detail(integer, integer, uuid[]);

CREATE OR REPLACE FUNCTION public.get_monthly_payouts_detail(p_year integer, p_month integer, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(
   restaurant_id uuid, 
   payout_date date, 
   sales_incl_vat numeric, 
   refund_incl_vat numeric, 
   item_promo_incl_vat numeric, 
   uber_fee_after_promo_incl_vat numeric, 
   uber_fee_before_promo_excl_vat numeric, 
   uber_fee_promo_excl_vat numeric, 
   vat_uber_fee numeric, 
   delivery_promo_incl_vat numeric, 
   other_payments_incl_vat numeric, 
   net_payout numeric, 
   order_count integer, 
   tips numeric, 
   marketing_fee_adjustment numeric,
   meal_voucher_amount numeric
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
    COALESCE(p.sales_incl_vat, 0) as sales_incl_vat,
    COALESCE(p.refund_incl_vat, 0) as refund_incl_vat,
    COALESCE(p.item_promo_incl_vat, 0) as item_promo_incl_vat,
    COALESCE(p.uber_fee_after_promo_incl_vat, 0) as uber_fee_after_promo_incl_vat,
    COALESCE(p.uber_fee_before_promo_excl_vat, 0) as uber_fee_before_promo_excl_vat,
    COALESCE(p.uber_fee_promo_excl_vat, 0) as uber_fee_promo_excl_vat,
    COALESCE(p.vat_uber_fee, 0) as vat_uber_fee,
    COALESCE(p.delivery_promo_incl_vat, 0) as delivery_promo_incl_vat,
    COALESCE(p.other_payments_incl_vat, 0) as other_payments_incl_vat,
    COALESCE(p.net_payout, 0) as net_payout,
    COALESCE(p.order_count, 0)::INTEGER as order_count,
    COALESCE(p.tips, 0) as tips,
    COALESCE(p.marketing_fee_adjustment, 0) as marketing_fee_adjustment,
    COALESCE(p.meal_voucher_amount, 0) as meal_voucher_amount
  FROM public.payouts p
  WHERE EXTRACT(YEAR FROM p.payout_date) = p_year
    AND EXTRACT(MONTH FROM p.payout_date) = p_month
    AND (p_restaurant_ids IS NULL OR p.restaurant_id = ANY(p_restaurant_ids))
  ORDER BY p.payout_date ASC, p.restaurant_id ASC;
END;
$function$;
