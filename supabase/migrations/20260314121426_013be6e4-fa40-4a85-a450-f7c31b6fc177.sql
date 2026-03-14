
-- Drop both overloads and recreate a single clean version with date params
DROP FUNCTION IF EXISTS public.get_offers_analytics(uuid[], text, text);
DROP FUNCTION IF EXISTS public.get_offers_analytics(uuid[], date, date);

CREATE OR REPLACE FUNCTION public.get_offers_analytics(
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
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
STABLE
SET search_path TO 'public'
SET statement_timeout TO '30s'
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
    AND (p_end_date IS NULL OR o.order_datetime < (p_end_date + 1)::timestamp)
  GROUP BY o.restaurant_id, to_char(o.order_datetime, 'YYYY-MM')
  ORDER BY month_key, o.restaurant_id;
END;
$$;
