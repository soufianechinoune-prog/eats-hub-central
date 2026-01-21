CREATE OR REPLACE FUNCTION public.get_profitability_daily(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, day date, sales numeric, payout numeric, net_payout numeric, meal_voucher numeric, orders_count bigint, item_promo_incl_vat numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF array_length(p_restaurant_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF (p_end_date - p_start_date) > 400 THEN
    RAISE EXCEPTION 'Date range cannot exceed 400 days';
  END IF;

  RETURN QUERY
  SELECT 
    o.restaurant_id,
    (o.order_datetime AT TIME ZONE 'Europe/Paris')::date as day,
    COALESCE(SUM(ABS(o.sales_incl_vat)), 0)::numeric as sales,
    COALESCE(SUM(o.net_payout + COALESCE(o.meal_voucher_amount, 0)), 0)::numeric as payout,
    COALESCE(SUM(o.net_payout), 0)::numeric as net_payout,
    COALESCE(SUM(COALESCE(o.meal_voucher_amount, 0)), 0)::numeric as meal_voucher,
    COUNT(*)::bigint as orders_count,
    -- Promos as a POSITIVE amount (so Net base = Sales - Promos)
    COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat, 0))), 0)::numeric as item_promo_incl_vat
  FROM public.orders o
  WHERE 
    o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime < ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date
  ORDER BY day ASC;
END;
$function$;