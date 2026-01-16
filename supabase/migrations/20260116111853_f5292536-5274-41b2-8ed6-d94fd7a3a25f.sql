-- Function to aggregate orders by day for profitability analysis
-- Returns daily totals for each restaurant to avoid fetching all orders
CREATE OR REPLACE FUNCTION public.get_profitability_daily(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  restaurant_id uuid,
  day date,
  sales numeric,
  payout numeric,
  orders_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
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
    COALESCE(SUM(ABS(o.sales_incl_vat)), 0)::numeric as sales,
    COALESCE(SUM(o.net_payout + ABS(COALESCE(o.meal_voucher_amount, 0))), 0)::numeric as payout,
    COUNT(*)::bigint as orders_count
  FROM orders o
  WHERE 
    o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime < ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date
  ORDER BY day ASC;
END;
$$;