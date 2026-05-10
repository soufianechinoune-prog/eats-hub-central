CREATE OR REPLACE FUNCTION public.get_daily_revenue_from_orders(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  restaurant_id uuid,
  date date,
  platform text,
  revenue_ttc numeric,
  order_count bigint,
  average_basket numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    o.restaurant_id,
    ((o.order_datetime AT TIME ZONE 'Europe/Paris'))::date AS date,
    'uber_eats'::TEXT AS platform,
    COALESCE(SUM(o.sales_incl_vat), 0) AS revenue_ttc,
    COUNT(*) AS order_count,
    CASE WHEN COUNT(*) > 0 
      THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2)
      ELSE 0 
    END AS average_basket
  FROM public.orders o
  WHERE o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY o.restaurant_id, ((o.order_datetime AT TIME ZONE 'Europe/Paris'))::date
  ORDER BY 2;
END;
$function$;