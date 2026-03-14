-- Add offer usage fee columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_usage_fee numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_offer_usage_fee numeric DEFAULT 0;

-- Also add to payouts table for payout-level tracking
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS offer_usage_fee numeric DEFAULT 0;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS vat_offer_usage_fee numeric DEFAULT 0;

-- Update RPC to use new columns
CREATE OR REPLACE FUNCTION get_offers_analytics(
  p_restaurant_ids uuid[],
  p_start_date text,
  p_end_date text
)
RETURNS TABLE(
  restaurant_id uuid,
  month_key text,
  total_orders bigint,
  promo_orders bigint,
  taxed_orders bigint,
  total_offer_fees numeric,
  total_promo_amount numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.restaurant_id,
    to_char(o.order_datetime, 'YYYY-MM') as month_key,
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE COALESCE(o.item_promo_incl_vat, 0) != 0)::bigint as promo_orders,
    COUNT(*) FILTER (WHERE COALESCE(o.offer_usage_fee, 0) != 0)::bigint as taxed_orders,
    COALESCE(SUM(ABS(COALESCE(o.offer_usage_fee, 0)) + ABS(COALESCE(o.vat_offer_usage_fee, 0))), 0)::numeric as total_offer_fees,
    COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat, 0))), 0)::numeric as total_promo_amount
  FROM public.orders o
  WHERE (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    AND (p_start_date IS NULL OR o.order_datetime >= p_start_date::timestamp)
    AND (p_end_date IS NULL OR o.order_datetime < (p_end_date + interval '1 day')::timestamp)
  GROUP BY o.restaurant_id, to_char(o.order_datetime, 'YYYY-MM')
  ORDER BY month_key, o.restaurant_id;
END;
$$;