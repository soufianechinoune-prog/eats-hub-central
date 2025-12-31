-- Drop the existing function and recreate with new return type
DROP FUNCTION IF EXISTS public.get_monthly_payouts_summary(integer, uuid[]);

CREATE OR REPLACE FUNCTION public.get_monthly_payouts_summary(p_year integer, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(restaurant_id uuid, month integer, year integer, sales_incl_vat numeric, refund_incl_vat numeric, item_promo_incl_vat numeric, uber_fee_incl_vat numeric, delivery_promo_incl_vat numeric, other_payments_incl_vat numeric, net_payout numeric, order_count bigint, tips numeric, marketing_fee_adjustment numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.restaurant_id,
    EXTRACT(MONTH FROM p.payout_date)::integer as month,
    EXTRACT(YEAR FROM p.payout_date)::integer as year,
    COALESCE(SUM(p.sales_incl_vat), 0) as sales_incl_vat,
    COALESCE(SUM(p.refund_incl_vat), 0) as refund_incl_vat,
    COALESCE(SUM(p.item_promo_incl_vat), 0) as item_promo_incl_vat,
    COALESCE(SUM(p.uber_fee_after_promo_incl_vat), 0) as uber_fee_incl_vat,
    COALESCE(SUM(p.delivery_promo_incl_vat), 0) as delivery_promo_incl_vat,
    COALESCE(SUM(p.other_payments_incl_vat), 0) as other_payments_incl_vat,
    COALESCE(SUM(p.net_payout), 0) as net_payout,
    COALESCE(SUM(p.order_count), 0)::bigint as order_count,
    COALESCE(SUM(p.tips), 0) as tips,
    COALESCE(SUM(p.marketing_fee_adjustment), 0) as marketing_fee_adjustment
  FROM public.payouts p
  WHERE EXTRACT(YEAR FROM p.payout_date) = p_year
    AND (p_restaurant_ids IS NULL OR p.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY p.restaurant_id, EXTRACT(YEAR FROM p.payout_date), EXTRACT(MONTH FROM p.payout_date)
  ORDER BY month;
END;
$function$;