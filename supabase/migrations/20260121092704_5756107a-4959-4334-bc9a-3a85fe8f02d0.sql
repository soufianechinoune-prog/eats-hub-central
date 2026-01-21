-- Drop existing function first to change return type
DROP FUNCTION IF EXISTS public.get_profitability_daily(uuid[], date, date);

-- Recreate with new column item_promo_incl_vat
CREATE OR REPLACE FUNCTION public.get_profitability_daily(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, day date, sales numeric, payout numeric, net_payout numeric, meal_voucher numeric, orders_count bigint, item_promo_incl_vat numeric)
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
    -- Sales: use ABS to include ALL transaction lines (consistent with useFinancesDrilldown)
    COALESCE(SUM(ABS(o.sales_incl_vat)), 0)::numeric as sales,
    -- Total payout (for backward compatibility): net_payout + meal vouchers
    COALESCE(SUM(o.net_payout + COALESCE(o.meal_voucher_amount, 0)), 0)::numeric as payout,
    -- Net payout from Uber only (WITHOUT meal vouchers)
    COALESCE(SUM(o.net_payout), 0)::numeric as net_payout,
    -- Meal vouchers separately (external payment from Swile/Edenred)
    COALESCE(SUM(COALESCE(o.meal_voucher_amount, 0)), 0)::numeric as meal_voucher,
    -- Count all order lines
    COUNT(*)::bigint as orders_count,
    -- Item promotions (promos articles)
    COALESCE(SUM(COALESCE(o.item_promo_incl_vat, 0)), 0)::numeric as item_promo_incl_vat
  FROM orders o
  WHERE 
    o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime < ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date
  ORDER BY day ASC;
END;
$function$;