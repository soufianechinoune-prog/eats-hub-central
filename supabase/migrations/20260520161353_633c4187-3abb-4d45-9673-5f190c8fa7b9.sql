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
BEGIN
  IF public.is_super_admin() THEN
    v_ids := p_restaurant_ids;
  ELSE
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE public.user_has_chain_access(r.chain_id)
       AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));
  END IF;

  IF v_ids IS NULL THEN
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
    GROUP BY o.restaurant_id, EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'));
    RETURN;
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
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
  FROM unnest(v_ids) AS ids(restaurant_id)
  JOIN public.orders o ON o.restaurant_id = ids.restaurant_id
  WHERE o.order_datetime >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND o.order_datetime <  make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris')
  GROUP BY o.restaurant_id, EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'));
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
BEGIN
  IF public.is_super_admin() THEN
    v_ids := p_restaurant_ids;
  ELSE
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE public.user_has_chain_access(r.chain_id)
       AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));
  END IF;

  IF v_ids IS NULL THEN
    RETURN QUERY
    SELECT
      o.restaurant_id,
      p_year AS year,
      EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS month,
      'uber_eats'::text AS platform,
      COALESCE(SUM(o.sales_incl_vat), 0) AS revenue_ttc,
      COUNT(*)::bigint AS order_count,
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2) ELSE 0 END AS average_basket
    FROM public.orders o
    WHERE o.order_datetime >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Paris')
      AND o.order_datetime <  make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris')
    GROUP BY o.restaurant_id, EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'));
    RETURN;
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.restaurant_id,
    p_year AS year,
    EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS month,
    'uber_eats'::text AS platform,
    COALESCE(SUM(o.sales_incl_vat), 0) AS revenue_ttc,
    COUNT(*)::bigint AS order_count,
    CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2) ELSE 0 END AS average_basket
  FROM unnest(v_ids) AS ids(restaurant_id)
  JOIN public.orders o ON o.restaurant_id = ids.restaurant_id
  WHERE o.order_datetime >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Paris')
    AND o.order_datetime <  make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Paris')
  GROUP BY o.restaurant_id, EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'));
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
BEGIN
  IF public.is_super_admin() THEN
    v_ids := p_restaurant_ids;
  ELSE
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
      INTO v_ids
      FROM public.restaurants r
     WHERE public.user_has_chain_access(r.chain_id)
       AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));
  END IF;

  IF v_ids IS NULL THEN
    RETURN QUERY
    SELECT
      o.restaurant_id,
      (o.order_datetime AT TIME ZONE 'Europe/Paris')::date AS date,
      'uber_eats'::text AS platform,
      COALESCE(SUM(o.sales_incl_vat), 0) AS revenue_ttc,
      COUNT(*)::bigint AS order_count,
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2) ELSE 0 END AS average_basket
    FROM public.orders o
    WHERE o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
      AND o.order_datetime <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
    GROUP BY o.restaurant_id, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date
    ORDER BY 2;
    RETURN;
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.restaurant_id,
    (o.order_datetime AT TIME ZONE 'Europe/Paris')::date AS date,
    'uber_eats'::text AS platform,
    COALESCE(SUM(o.sales_incl_vat), 0) AS revenue_ttc,
    COUNT(*)::bigint AS order_count,
    CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2) ELSE 0 END AS average_basket
  FROM unnest(v_ids) AS ids(restaurant_id)
  JOIN public.orders o ON o.restaurant_id = ids.restaurant_id
  WHERE o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date
  ORDER BY 2;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_profitability_daily(
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
SET statement_timeout TO '45s'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF array_length(p_restaurant_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF (p_end_date - p_start_date) > 400 THEN
    RAISE EXCEPTION 'Date range cannot exceed 400 days';
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
    (o.order_datetime AT TIME ZONE 'UTC')::date AS day,
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
  GROUP BY o.restaurant_id, (o.order_datetime AT TIME ZONE 'UTC')::date
  ORDER BY day ASC;
END;
$function$;