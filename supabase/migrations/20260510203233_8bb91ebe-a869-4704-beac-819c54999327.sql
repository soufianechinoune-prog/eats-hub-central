
CREATE OR REPLACE FUNCTION public.get_monthly_revenue_from_orders(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  restaurant_id uuid,
  year integer,
  month integer,
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
    p_year AS year,
    EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS month,
    'uber_eats'::TEXT AS platform,
    COALESCE(SUM(o.sales_incl_vat), 0) AS revenue_ttc,
    COUNT(*) AS order_count,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2)
      ELSE 0
    END AS average_basket
  FROM public.orders o
  WHERE o.order_datetime >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND o.order_datetime <  make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY o.restaurant_id, EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'));
END;
$function$;
