
CREATE OR REPLACE FUNCTION public.get_meal_voucher_breakdown(
  p_restaurant_ids uuid[],
  p_date_from date,
  p_date_to date
)
RETURNS TABLE (
  restaurant_id uuid,
  provider text,
  amount numeric,
  order_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.restaurant_id,
    o.meal_voucher_provider AS provider,
    SUM(o.meal_voucher_amount)::numeric AS amount,
    COUNT(*)::bigint AS order_count
  FROM public.orders o
  WHERE o.restaurant_id = ANY(p_restaurant_ids)
    AND o.meal_voucher_amount IS NOT NULL
    AND o.meal_voucher_amount > 0
    AND o.meal_voucher_provider IN ('Edenred','Swile','Sodexo','UpDejeuner','Bimpli (ex Apetiz)','Pluxee')
    AND o.order_datetime >= (p_date_from::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime <  ((p_date_to + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id, o.meal_voucher_provider;
$$;

CREATE OR REPLACE FUNCTION public.get_meal_voucher_totals(
  p_restaurant_ids uuid[],
  p_date_from date,
  p_date_to date
)
RETURNS TABLE (
  restaurant_id uuid,
  uber_revenue_ttc numeric,
  uber_order_count bigint,
  tr_amount numeric,
  tr_order_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.restaurant_id,
    COALESCE(SUM(o.sales_incl_vat), 0)::numeric AS uber_revenue_ttc,
    COUNT(*)::bigint AS uber_order_count,
    COALESCE(SUM(CASE WHEN o.meal_voucher_provider IN ('Edenred','Swile','Sodexo','UpDejeuner','Bimpli (ex Apetiz)','Pluxee') THEN o.meal_voucher_amount ELSE 0 END), 0)::numeric AS tr_amount,
    COUNT(*) FILTER (WHERE o.meal_voucher_provider IN ('Edenred','Swile','Sodexo','UpDejeuner','Bimpli (ex Apetiz)','Pluxee') AND o.meal_voucher_amount > 0)::bigint AS tr_order_count
  FROM public.orders o
  WHERE o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= (p_date_from::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime <  ((p_date_to + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id;
$$;
