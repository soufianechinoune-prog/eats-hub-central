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
SET statement_timeout TO '45s'
AS $function$
DECLARE
  v_ids uuid[];
  v_start timestamptz := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Paris');
  v_end timestamptz := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris');
BEGIN
  IF public.is_super_admin() AND p_restaurant_ids IS NOT NULL THEN
    v_ids := p_restaurant_ids;
  ELSE
    SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
       AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_restaurant AS (
    SELECT
      ids.restaurant_id,
      EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS month,
      COALESCE(SUM(o.sales_incl_vat), 0) AS sales_incl_vat,
      COALESCE(SUM(o.refund_incl_vat), 0) AS refund_incl_vat,
      COALESCE(SUM(o.item_promo_incl_vat), 0) AS item_promo_incl_vat,
      COALESCE(SUM(o.uber_fee_after_promo_incl_vat), 0) AS uber_fee_incl_vat,
      COALESCE(SUM(o.delivery_promo_incl_vat), 0) AS delivery_promo_incl_vat,
      COALESCE(SUM(o.other_payments_incl_vat), 0) AS other_payments_incl_vat,
      COALESCE(SUM(o.net_payout), 0) AS net_payout,
      COUNT(o.*)::bigint AS order_count,
      COALESCE(SUM(o.tip_amount), 0) AS tips,
      COALESCE(SUM(o.marketing_fee_adjustment), 0) AS marketing_fee_adjustment
    FROM unnest(v_ids) AS ids(restaurant_id)
    CROSS JOIN LATERAL (
      SELECT
        order_datetime,
        sales_incl_vat,
        refund_incl_vat,
        item_promo_incl_vat,
        uber_fee_after_promo_incl_vat,
        delivery_promo_incl_vat,
        other_payments_incl_vat,
        net_payout,
        tip_amount,
        marketing_fee_adjustment
      FROM public.orders o
      WHERE o.restaurant_id = ids.restaurant_id
        AND o.order_datetime >= v_start
        AND o.order_datetime < v_end
    ) o
    GROUP BY ids.restaurant_id, EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))
  )
  SELECT
    p.restaurant_id,
    p.month,
    p_year AS year,
    p.sales_incl_vat,
    p.refund_incl_vat,
    p.item_promo_incl_vat,
    p.uber_fee_incl_vat,
    p.delivery_promo_incl_vat,
    p.other_payments_incl_vat,
    p.net_payout,
    p.order_count,
    p.tips,
    p.marketing_fee_adjustment
  FROM per_restaurant p;
END;
$function$;

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
SET statement_timeout TO '45s'
AS $function$
DECLARE
  v_ids uuid[];
  v_start timestamptz := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Paris');
  v_end timestamptz := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris');
BEGIN
  IF public.is_super_admin() AND p_restaurant_ids IS NOT NULL THEN
    v_ids := p_restaurant_ids;
  ELSE
    SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
       AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_restaurant AS (
    SELECT
      ids.restaurant_id,
      EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS month,
      COALESCE(SUM(o.sales_incl_vat), 0) AS revenue_ttc,
      COUNT(o.*)::bigint AS order_count
    FROM unnest(v_ids) AS ids(restaurant_id)
    CROSS JOIN LATERAL (
      SELECT order_datetime, sales_incl_vat
      FROM public.orders o
      WHERE o.restaurant_id = ids.restaurant_id
        AND o.order_datetime >= v_start
        AND o.order_datetime < v_end
    ) o
    GROUP BY ids.restaurant_id, EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))
  )
  SELECT
    p.restaurant_id,
    p_year AS year,
    p.month,
    'uber_eats'::text AS platform,
    p.revenue_ttc,
    p.order_count,
    CASE WHEN p.order_count > 0 THEN ROUND(p.revenue_ttc / p.order_count, 2) ELSE 0 END AS average_basket
  FROM per_restaurant p;
END;
$function$;

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
SET statement_timeout TO '45s'
AS $function$
DECLARE
  v_ids uuid[];
  v_start timestamptz := (p_start_date::timestamp AT TIME ZONE 'Europe/Paris');
  v_end timestamptz := ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris');
BEGIN
  IF public.is_super_admin() AND p_restaurant_ids IS NOT NULL THEN
    v_ids := p_restaurant_ids;
  ELSE
    SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
       AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_restaurant AS (
    SELECT
      ids.restaurant_id,
      (o.order_datetime AT TIME ZONE 'Europe/Paris')::date AS date,
      COALESCE(SUM(o.sales_incl_vat), 0) AS revenue_ttc,
      COUNT(o.*)::bigint AS order_count
    FROM unnest(v_ids) AS ids(restaurant_id)
    CROSS JOIN LATERAL (
      SELECT order_datetime, sales_incl_vat
      FROM public.orders o
      WHERE o.restaurant_id = ids.restaurant_id
        AND o.order_datetime >= v_start
        AND o.order_datetime < v_end
    ) o
    GROUP BY ids.restaurant_id, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date
  )
  SELECT
    p.restaurant_id,
    p.date,
    'uber_eats'::text AS platform,
    p.revenue_ttc,
    p.order_count,
    CASE WHEN p.order_count > 0 THEN ROUND(p.revenue_ttc / p.order_count, 2) ELSE 0 END AS average_basket
  FROM per_restaurant p
  ORDER BY p.date;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_orders_finance_summary(integer, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_revenue_from_orders(integer, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_revenue_from_orders(date, date, uuid[]) TO authenticated;