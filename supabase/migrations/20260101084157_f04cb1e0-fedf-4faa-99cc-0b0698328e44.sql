
-- Function to get detailed payout data for a specific month
CREATE OR REPLACE FUNCTION public.get_monthly_payouts_detail(
  p_year INTEGER,
  p_month INTEGER,
  p_restaurant_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  restaurant_id UUID,
  payout_date DATE,
  sales_incl_vat NUMERIC,
  refund_incl_vat NUMERIC,
  item_promo_incl_vat NUMERIC,
  uber_fee_after_promo_incl_vat NUMERIC,
  delivery_promo_incl_vat NUMERIC,
  other_payments_incl_vat NUMERIC,
  net_payout NUMERIC,
  order_count INTEGER,
  tips NUMERIC,
  marketing_fee_adjustment NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.restaurant_id,
    p.payout_date,
    COALESCE(p.sales_incl_vat, 0) as sales_incl_vat,
    COALESCE(p.refund_incl_vat, 0) as refund_incl_vat,
    COALESCE(p.item_promo_incl_vat, 0) as item_promo_incl_vat,
    COALESCE(p.uber_fee_after_promo_incl_vat, 0) as uber_fee_after_promo_incl_vat,
    COALESCE(p.delivery_promo_incl_vat, 0) as delivery_promo_incl_vat,
    COALESCE(p.other_payments_incl_vat, 0) as other_payments_incl_vat,
    COALESCE(p.net_payout, 0) as net_payout,
    COALESCE(p.order_count, 0)::INTEGER as order_count,
    COALESCE(p.tips, 0) as tips,
    COALESCE(p.marketing_fee_adjustment, 0) as marketing_fee_adjustment
  FROM public.payouts p
  WHERE EXTRACT(YEAR FROM p.payout_date) = p_year
    AND EXTRACT(MONTH FROM p.payout_date) = p_month
    AND (p_restaurant_ids IS NULL OR p.restaurant_id = ANY(p_restaurant_ids))
  ORDER BY p.payout_date ASC, p.restaurant_id ASC;
END;
$$;
