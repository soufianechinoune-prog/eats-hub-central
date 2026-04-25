-- 1) get_monthly_revenue_from_orders : remplacer EXTRACT(YEAR ...) par plage indexable
CREATE OR REPLACE FUNCTION public.get_monthly_revenue_from_orders(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(restaurant_id uuid, year integer, month integer, platform text,
              revenue_ttc numeric, order_count bigint, average_basket numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    o.restaurant_id,
    EXTRACT(YEAR FROM o.order_datetime)::INTEGER as year,
    EXTRACT(MONTH FROM o.order_datetime)::INTEGER as month,
    'uber_eats'::TEXT as platform,
    COALESCE(SUM(o.sales_incl_vat), 0) as revenue_ttc,
    COUNT(*) as order_count,
    CASE WHEN COUNT(*) > 0 
      THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2)
      ELSE 0 
    END as average_basket
  FROM public.orders o
  WHERE o.order_datetime >= make_date(p_year, 1, 1)::timestamp
    AND o.order_datetime <  make_date(p_year + 1, 1, 1)::timestamp
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY o.restaurant_id, EXTRACT(YEAR FROM o.order_datetime), EXTRACT(MONTH FROM o.order_datetime)
  ORDER BY month;
END;
$function$;

-- 2) get_daily_revenue_from_orders : cast explicite + statement_timeout
CREATE OR REPLACE FUNCTION public.get_daily_revenue_from_orders(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(restaurant_id uuid, date date, platform text,
              revenue_ttc numeric, order_count bigint, average_basket numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    o.restaurant_id,
    DATE(o.order_datetime) as date,
    'uber_eats'::TEXT as platform,
    COALESCE(SUM(o.sales_incl_vat), 0) as revenue_ttc,
    COUNT(*) as order_count,
    CASE WHEN COUNT(*) > 0 
      THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2)
      ELSE 0 
    END as average_basket
  FROM public.orders o
  WHERE o.order_datetime >= p_start_date::timestamp
    AND o.order_datetime <  (p_end_date + interval '1 day')::timestamp
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY o.restaurant_id, DATE(o.order_datetime)
  ORDER BY date;
END;
$function$;