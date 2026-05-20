-- Optimize get_orders_finance_summary: resolve accessible restaurants ONCE
-- instead of running RBAC checks per row across millions of orders.
CREATE OR REPLACE FUNCTION public.get_orders_finance_summary(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  restaurant_id uuid,
  month integer,
  year integer,
  sales_incl_vat numeric,
  refund_incl_vat numeric,
  item_promo_incl_vat numeric,
  uber_fee_incl_vat numeric,
  delivery_promo_incl_vat numeric,
  other_payments_incl_vat numeric,
  net_payout numeric,
  order_count bigint,
  tips numeric,
  marketing_fee_adjustment numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '25s'
AS $function$
DECLARE
  v_is_super boolean := public.is_super_admin();
  v_ids uuid[];
BEGIN
  IF v_is_super THEN
    -- Super admin: trust p_restaurant_ids as provided (NULL = all)
    v_ids := p_restaurant_ids;
  ELSE
    -- Resolve accessible restaurants ONCE
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE public.user_has_chain_access(r.chain_id)
       AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));

    IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    o.restaurant_id,
    EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS month,
    p_year AS year,
    COALESCE(SUM(o.sales_incl_vat), 0) AS sales_incl_vat,
    COALESCE(SUM(o.refund_incl_vat), 0) AS refund_incl_vat,
    COALESCE(SUM(o.item_promo_incl_vat), 0) AS item_promo_incl_vat,
    COALESCE(SUM(o.uber_fee_after_promo_incl_vat), 0) AS uber_fee_incl_vat,
    COALESCE(SUM(o.delivery_promo_incl_vat), 0) AS delivery_promo_incl_vat,
    COALESCE(SUM(o.other_payments_incl_vat), 0) AS other_payments_incl_vat,
    COALESCE(SUM(o.net_payout), 0) AS net_payout,
    COUNT(*)::bigint AS order_count,
    COALESCE(SUM(o.tip_amount), 0) AS tips,
    COALESCE(SUM(o.marketing_fee_adjustment), 0) AS marketing_fee_adjustment
  FROM public.orders o
  WHERE o.order_datetime >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND o.order_datetime <  make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND (v_ids IS NULL OR o.restaurant_id = ANY(v_ids))
  GROUP BY o.restaurant_id, EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'));
END;
$function$;

-- Also bump timeout for profitability daily (no RBAC change needed; already filters by ids)
ALTER FUNCTION public.get_profitability_daily(uuid[], date, date) SET statement_timeout TO '25s';