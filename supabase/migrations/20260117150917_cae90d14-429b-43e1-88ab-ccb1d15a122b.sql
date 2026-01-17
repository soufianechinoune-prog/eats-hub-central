-- First drop the existing function to change return type
DROP FUNCTION IF EXISTS public.get_profitability_daily(uuid[], date, date);

-- Recreate with separated net_payout and meal_voucher columns
CREATE OR REPLACE FUNCTION public.get_profitability_daily(
  p_restaurant_ids uuid[], 
  p_start_date date, 
  p_end_date date
)
RETURNS TABLE(
  restaurant_id uuid, 
  day date, 
  sales numeric, 
  payout numeric,
  net_payout numeric,
  meal_voucher numeric,
  orders_count bigint
)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  -- Validate inputs
  IF array_length(p_restaurant_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  
  -- Limit date range to 400 days for safety
  IF (p_end_date - p_start_date) > 400 THEN
    RAISE EXCEPTION 'Date range cannot exceed 400 days';
  END IF;

  RETURN QUERY
  SELECT 
    o.restaurant_id,
    (o.order_datetime AT TIME ZONE 'Europe/Paris')::date as day,
    -- Sales: only positive values (real orders, not refunds)
    COALESCE(SUM(CASE WHEN o.sales_incl_vat > 0 THEN o.sales_incl_vat ELSE 0 END), 0)::numeric as sales,
    -- Total payout (for backward compatibility): net_payout + meal vouchers
    COALESCE(SUM(o.net_payout + COALESCE(o.meal_voucher_amount, 0)), 0)::numeric as payout,
    -- Net payout from Uber only (WITHOUT meal vouchers)
    COALESCE(SUM(o.net_payout), 0)::numeric as net_payout,
    -- Meal vouchers separately (external payment from Swile/Edenred)
    COALESCE(SUM(COALESCE(o.meal_voucher_amount, 0)), 0)::numeric as meal_voucher,
    -- Count only actual orders (with positive sales)
    COUNT(CASE WHEN o.sales_incl_vat > 0 THEN 1 END)::bigint as orders_count
  FROM orders o
  WHERE 
    o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime < ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date
  ORDER BY day ASC;
END;
$function$;

COMMENT ON FUNCTION public.get_profitability_daily IS 
'Returns daily profitability data with separated metrics:
- sales: Gross sales TTC (only positive orders)
- payout: Total received (net_payout + meal_voucher) - for backward compatibility
- net_payout: What Uber pays (without meal vouchers) - for Marge Uber calculation
- meal_voucher: External payment from Swile/Edenred - for TR Bonus calculation
- orders_count: Number of orders

Marge Uber = net_payout / sales (should be ~65%)
TR Bonus = meal_voucher / sales (should be ~9%)
Total Encaissé = payout / sales (should be ~74%)';