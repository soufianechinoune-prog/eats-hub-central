
-- Fix the profitability calculation by removing ABS() which was inflating sales
-- ABS() was converting negative values (refunds, corrections) to positive, 
-- artificially increasing the total sales and distorting the profitability ratio

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
    -- REMOVED ABS() - keep actual sales values (negative for refunds/corrections)
    -- Only count orders with positive sales for the profitability ratio
    COALESCE(SUM(CASE WHEN o.sales_incl_vat > 0 THEN o.sales_incl_vat ELSE 0 END), 0)::numeric as sales,
    -- Payout: net_payout + meal vouchers (meal vouchers are always positive gains)
    COALESCE(SUM(o.net_payout + COALESCE(o.meal_voucher_amount, 0)), 0)::numeric as payout,
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

COMMENT ON FUNCTION public.get_profitability_daily IS 'Returns daily profitability data. Sales only includes positive values (excludes refunds). Payout includes net_payout + meal vouchers.';
