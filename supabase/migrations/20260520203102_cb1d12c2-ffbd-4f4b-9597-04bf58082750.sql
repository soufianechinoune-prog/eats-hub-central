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
  SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.restaurants r
   WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
     AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_restaurant AS (
    SELECT
      ids.restaurant_id AS agg_restaurant_id,
      EXTRACT(MONTH FROM (ord.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS agg_month,
      COALESCE(SUM(ord.sales_incl_vat), 0) AS agg_sales_incl_vat,
      COALESCE(SUM(ord.refund_incl_vat), 0) AS agg_refund_incl_vat,
      COALESCE(SUM(ord.item_promo_incl_vat), 0) AS agg_item_promo_incl_vat,
      COALESCE(SUM(ord.uber_fee_after_promo_incl_vat), 0) AS agg_uber_fee_incl_vat,
      COALESCE(SUM(ord.delivery_promo_incl_vat), 0) AS agg_delivery_promo_incl_vat,
      COALESCE(SUM(ord.other_payments_incl_vat), 0) AS agg_other_payments_incl_vat,
      COALESCE(SUM(ord.net_payout), 0) AS agg_net_payout,
      COUNT(ord.*)::bigint AS agg_order_count,
      COALESCE(SUM(ord.tip_amount), 0) AS agg_tips,
      COALESCE(SUM(ord.marketing_fee_adjustment), 0) AS agg_marketing_fee_adjustment
    FROM unnest(v_ids) AS ids(restaurant_id)
    CROSS JOIN LATERAL (
      SELECT
        o.order_datetime,
        o.sales_incl_vat,
        o.refund_incl_vat,
        o.item_promo_incl_vat,
        o.uber_fee_after_promo_incl_vat,
        o.delivery_promo_incl_vat,
        o.other_payments_incl_vat,
        o.net_payout,
        o.tip_amount,
        o.marketing_fee_adjustment
      FROM public.orders o
      WHERE o.restaurant_id = ids.restaurant_id
        AND o.order_datetime >= v_start
        AND o.order_datetime < v_end
    ) ord
    GROUP BY ids.restaurant_id, EXTRACT(MONTH FROM (ord.order_datetime AT TIME ZONE 'Europe/Paris'))
  )
  SELECT
    p.agg_restaurant_id,
    p.agg_month,
    p_year,
    p.agg_sales_incl_vat,
    p.agg_refund_incl_vat,
    p.agg_item_promo_incl_vat,
    p.agg_uber_fee_incl_vat,
    p.agg_delivery_promo_incl_vat,
    p.agg_other_payments_incl_vat,
    p.agg_net_payout,
    p.agg_order_count,
    p.agg_tips,
    p.agg_marketing_fee_adjustment
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
  SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.restaurants r
   WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
     AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_restaurant AS (
    SELECT
      ids.restaurant_id AS agg_restaurant_id,
      EXTRACT(MONTH FROM (ord.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS agg_month,
      COALESCE(SUM(ord.sales_incl_vat), 0) AS agg_revenue_ttc,
      COUNT(ord.*)::bigint AS agg_order_count
    FROM unnest(v_ids) AS ids(restaurant_id)
    CROSS JOIN LATERAL (
      SELECT o.order_datetime, o.sales_incl_vat
      FROM public.orders o
      WHERE o.restaurant_id = ids.restaurant_id
        AND o.order_datetime >= v_start
        AND o.order_datetime < v_end
    ) ord
    GROUP BY ids.restaurant_id, EXTRACT(MONTH FROM (ord.order_datetime AT TIME ZONE 'Europe/Paris'))
  )
  SELECT
    p.agg_restaurant_id,
    p_year,
    p.agg_month,
    'uber_eats'::text,
    p.agg_revenue_ttc,
    p.agg_order_count,
    CASE WHEN p.agg_order_count > 0 THEN ROUND(p.agg_revenue_ttc / p.agg_order_count, 2) ELSE 0 END
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
  SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.restaurants r
   WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
     AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_restaurant AS (
    SELECT
      ids.restaurant_id AS agg_restaurant_id,
      (ord.order_datetime AT TIME ZONE 'Europe/Paris')::date AS agg_date,
      COALESCE(SUM(ord.sales_incl_vat), 0) AS agg_revenue_ttc,
      COUNT(ord.*)::bigint AS agg_order_count
    FROM unnest(v_ids) AS ids(restaurant_id)
    CROSS JOIN LATERAL (
      SELECT o.order_datetime, o.sales_incl_vat
      FROM public.orders o
      WHERE o.restaurant_id = ids.restaurant_id
        AND o.order_datetime >= v_start
        AND o.order_datetime < v_end
    ) ord
    GROUP BY ids.restaurant_id, (ord.order_datetime AT TIME ZONE 'Europe/Paris')::date
  )
  SELECT
    p.agg_restaurant_id,
    p.agg_date,
    'uber_eats'::text,
    p.agg_revenue_ttc,
    p.agg_order_count,
    CASE WHEN p.agg_order_count > 0 THEN ROUND(p.agg_revenue_ttc / p.agg_order_count, 2) ELSE 0 END
  FROM per_restaurant p
  ORDER BY p.agg_date;
END;
$function$;