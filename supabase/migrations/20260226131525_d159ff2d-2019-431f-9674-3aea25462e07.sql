
-- 1. Orders payout summary (replaces paginated orders fetch in useNetworkStats Wave 3)
CREATE OR REPLACE FUNCTION public.get_network_orders_summary(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  restaurant_id uuid,
  total_sales_incl_vat numeric,
  total_net_payout numeric,
  total_item_promo_incl_vat numeric,
  total_meal_voucher numeric,
  order_count bigint
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    o.restaurant_id,
    COALESCE(SUM(GREATEST(o.sales_incl_vat, 0)), 0)::numeric AS total_sales_incl_vat,
    COALESCE(SUM(o.net_payout), 0)::numeric AS total_net_payout,
    COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat, 0))), 0)::numeric AS total_item_promo_incl_vat,
    COALESCE(SUM(COALESCE(o.meal_voucher_amount, 0)), 0)::numeric AS total_meal_voucher,
    COUNT(*)::bigint AS order_count
  FROM public.orders o
  WHERE o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= p_start_date::timestamp
    AND o.order_datetime < (p_end_date + interval '1 day')::timestamp
  GROUP BY o.restaurant_id;
END;
$function$;

-- 2. Prep time summary (replaces paginated order_history fetch in useNetworkStats Wave 4 & useOverviewData)
CREATE OR REPLACE FUNCTION public.get_network_prep_time_summary(
  p_restaurant_ids uuid[],
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE(
  restaurant_id uuid,
  avg_prep_time numeric,
  avg_total_delivery_time numeric,
  avg_avoidable_wait_time numeric,
  prep_count bigint,
  delivery_count bigint,
  avoidable_wait_count bigint
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    oh.restaurant_id,
    ROUND(AVG(oh.initial_prep_time_minutes) FILTER (WHERE oh.initial_prep_time_minutes IS NOT NULL), 2) AS avg_prep_time,
    ROUND(AVG(oh.total_prep_delivery_time_minutes) FILTER (WHERE oh.total_prep_delivery_time_minutes IS NOT NULL), 2) AS avg_total_delivery_time,
    ROUND(AVG(oh.avoidable_wait_time_minutes) FILTER (WHERE oh.avoidable_wait_time_minutes IS NOT NULL), 2) AS avg_avoidable_wait_time,
    COUNT(*) FILTER (WHERE oh.initial_prep_time_minutes IS NOT NULL)::bigint AS prep_count,
    COUNT(*) FILTER (WHERE oh.total_prep_delivery_time_minutes IS NOT NULL)::bigint AS delivery_count,
    COUNT(*) FILTER (WHERE oh.avoidable_wait_time_minutes IS NOT NULL)::bigint AS avoidable_wait_count
  FROM public.order_history oh
  WHERE oh.restaurant_id = ANY(p_restaurant_ids)
    AND oh.order_datetime >= p_start_date
    AND oh.order_datetime <= p_end_date
  GROUP BY oh.restaurant_id;
END;
$function$;

-- 3. Deliveroo summary (replaces paginated deliveroo_orders fetch)
CREATE OR REPLACE FUNCTION public.get_network_deliveroo_summary(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  restaurant_id uuid,
  total_revenue numeric,
  total_payable numeric,
  order_count bigint
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.restaurant_id,
    COALESCE(SUM(d.order_amount), 0)::numeric AS total_revenue,
    COALESCE(SUM(d.total_payable), 0)::numeric AS total_payable,
    COUNT(*)::bigint AS order_count
  FROM public.deliveroo_orders d
  WHERE d.restaurant_id = ANY(p_restaurant_ids)
    AND d.history_type = 'Livraison'
    AND d.delivery_datetime >= p_start_date::timestamp
    AND d.delivery_datetime < (p_end_date + interval '1 day')::timestamp
  GROUP BY d.restaurant_id;
END;
$function$;
