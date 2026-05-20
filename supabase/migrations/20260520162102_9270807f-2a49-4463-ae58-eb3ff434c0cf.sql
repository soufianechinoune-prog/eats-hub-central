CREATE OR REPLACE FUNCTION public.get_profitability_monthly(
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
  orders_count bigint,
  item_promo_incl_vat numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_restaurant_ids IS NULL OR array_length(p_restaurant_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF public.is_super_admin() THEN
    v_ids := p_restaurant_ids;
  ELSE
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE public.user_has_chain_access(r.chain_id)
       AND r.id = ANY(p_restaurant_ids);
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.restaurant_id,
    date_trunc('month', (o.order_datetime AT TIME ZONE 'UTC'))::date AS day,
    COALESCE(SUM(ABS(o.sales_incl_vat)), 0)::numeric AS sales,
    COALESCE(SUM(o.net_payout + COALESCE(o.meal_voucher_amount, 0)), 0)::numeric AS payout,
    COALESCE(SUM(o.net_payout), 0)::numeric AS net_payout,
    COALESCE(SUM(COALESCE(o.meal_voucher_amount, 0)), 0)::numeric AS meal_voucher,
    COUNT(*)::bigint AS orders_count,
    COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat, 0))), 0)::numeric AS item_promo_incl_vat
  FROM unnest(v_ids) AS ids(restaurant_id)
  JOIN public.orders o ON o.restaurant_id = ids.restaurant_id
  WHERE o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'UTC')
    AND o.order_datetime < ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'UTC')
  GROUP BY o.restaurant_id, date_trunc('month', (o.order_datetime AT TIME ZONE 'UTC'))
  ORDER BY day ASC;
END;
$function$;