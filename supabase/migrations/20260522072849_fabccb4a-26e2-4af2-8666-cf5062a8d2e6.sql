
-- ============================================================
-- Finances drilldown: server-side aggregations (Uber Eats)
-- ============================================================

-- 1) Agrégat journalier par restaurant
CREATE OR REPLACE FUNCTION public.get_finances_daily_uber(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  restaurant_id uuid,
  day date,
  sales_incl_vat numeric,
  refund_incl_vat numeric,
  uber_fee_incl_vat numeric,
  promo_incl_vat numeric,
  net_payout numeric,
  meal_voucher_amount numeric,
  order_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '45s'
AS $$
DECLARE
  v_ids uuid[];
  v_start timestamptz := (p_start_date::timestamp) AT TIME ZONE 'UTC';
  v_end timestamptz := ((p_end_date + 1)::timestamp) AT TIME ZONE 'UTC';
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
  SELECT
    ids.restaurant_id AS restaurant_id,
    ((ord.order_datetime AT TIME ZONE 'UTC')::date) AS day,
    COALESCE(SUM(ABS(COALESCE(ord.sales_incl_vat, 0))), 0) AS sales_incl_vat,
    COALESCE(SUM(ABS(COALESCE(ord.refund_incl_vat, 0))), 0) AS refund_incl_vat,
    COALESCE(SUM(ABS(COALESCE(ord.uber_fee_after_promo_incl_vat, 0))), 0) AS uber_fee_incl_vat,
    COALESCE(SUM(ABS(COALESCE(ord.item_promo_incl_vat, 0))), 0) AS promo_incl_vat,
    COALESCE(SUM(COALESCE(ord.net_payout, 0)), 0) AS net_payout,
    COALESCE(SUM(COALESCE(ord.meal_voucher_amount, 0)), 0) AS meal_voucher_amount,
    COUNT(*)::bigint AS order_count
  FROM unnest(v_ids) AS ids(restaurant_id)
  CROSS JOIN LATERAL (
    SELECT o.order_datetime, o.sales_incl_vat, o.refund_incl_vat,
           o.uber_fee_after_promo_incl_vat, o.item_promo_incl_vat,
           o.net_payout, o.meal_voucher_amount
    FROM public.orders o
    WHERE o.restaurant_id = ids.restaurant_id
      AND o.order_datetime >= v_start
      AND o.order_datetime < v_end
  ) ord
  GROUP BY ids.restaurant_id, ((ord.order_datetime AT TIME ZONE 'UTC')::date);
END;
$$;

-- 2) Agrégat horaire (0-23) sur la période
CREATE OR REPLACE FUNCTION public.get_finances_hourly_uber(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  hour int,
  sales_incl_vat numeric,
  refund_incl_vat numeric,
  uber_fee_incl_vat numeric,
  promo_incl_vat numeric,
  net_payout numeric,
  meal_voucher_amount numeric,
  order_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '45s'
AS $$
DECLARE
  v_ids uuid[];
  v_start timestamptz := (p_start_date::timestamp) AT TIME ZONE 'UTC';
  v_end timestamptz := ((p_end_date + 1)::timestamp) AT TIME ZONE 'UTC';
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
  SELECT
    EXTRACT(HOUR FROM (ord.order_datetime AT TIME ZONE 'Europe/Paris'))::int AS hour,
    COALESCE(SUM(ABS(COALESCE(ord.sales_incl_vat, 0))), 0),
    COALESCE(SUM(ABS(COALESCE(ord.refund_incl_vat, 0))), 0),
    COALESCE(SUM(ABS(COALESCE(ord.uber_fee_after_promo_incl_vat, 0))), 0),
    COALESCE(SUM(ABS(COALESCE(ord.item_promo_incl_vat, 0))), 0),
    COALESCE(SUM(COALESCE(ord.net_payout, 0)), 0),
    COALESCE(SUM(COALESCE(ord.meal_voucher_amount, 0)), 0),
    COUNT(*)::bigint
  FROM unnest(v_ids) AS ids(restaurant_id)
  CROSS JOIN LATERAL (
    SELECT o.order_datetime, o.sales_incl_vat, o.refund_incl_vat,
           o.uber_fee_after_promo_incl_vat, o.item_promo_incl_vat,
           o.net_payout, o.meal_voucher_amount
    FROM public.orders o
    WHERE o.restaurant_id = ids.restaurant_id
      AND o.order_datetime >= v_start
      AND o.order_datetime < v_end
  ) ord
  GROUP BY EXTRACT(HOUR FROM (ord.order_datetime AT TIME ZONE 'Europe/Paris'));
END;
$$;

-- 3) Ventilation par produit (order_items joints aux orders filtrés)
CREATE OR REPLACE FUNCTION public.get_finances_products_uber(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  item_id text,
  item_title text,
  category text,
  quantity bigint,
  sales_incl_vat numeric,
  refund_incl_vat numeric,
  promo_incl_vat numeric,
  order_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  v_ids uuid[];
  v_start timestamptz := (p_start_date::timestamp) AT TIME ZONE 'UTC';
  v_end timestamptz := ((p_end_date + 1)::timestamp) AT TIME ZONE 'UTC';
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
  SELECT
    oi.item_id,
    MAX(oi.item_title) AS item_title,
    MAX(oi.category) AS category,
    COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)::bigint AS quantity,
    COALESCE(SUM(ABS(COALESCE(oi.sales_incl_vat, 0))), 0) AS sales_incl_vat,
    COALESCE(SUM(ABS(COALESCE(oi.refund_incl_vat, 0))), 0) AS refund_incl_vat,
    COALESCE(SUM(ABS(COALESCE(oi.item_promo_incl_vat, 0))), 0) AS promo_incl_vat,
    COUNT(DISTINCT oi.order_id)::bigint AS order_count
  FROM public.order_items oi
  WHERE oi.restaurant_id = ANY(v_ids)
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = oi.order_id
         AND o.order_datetime >= v_start
         AND o.order_datetime < v_end
    )
  GROUP BY oi.item_id
  ORDER BY sales_incl_vat DESC;
END;
$$;

-- 4) Liste paginée des commandes Uber Eats (avec total)
CREATE OR REPLACE FUNCTION public.get_finances_orders_paginated_uber(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_search text DEFAULT NULL,
  p_sort_field text DEFAULT 'order_datetime',
  p_sort_dir text DEFAULT 'desc',
  p_fulfillment text DEFAULT 'all',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  uber_order_id text,
  order_datetime timestamptz,
  sales_excl_vat numeric,
  vat_1_sales numeric,
  vat_2_sales numeric,
  vat_3_sales numeric,
  sales_incl_vat numeric,
  uber_fee_after_promo_incl_vat numeric,
  item_promo_incl_vat numeric,
  refund_incl_vat numeric,
  net_payout numeric,
  meal_voucher_amount numeric,
  promotion_discount numeric,
  fulfillment_type text,
  offer_usage_fee numeric,
  vat_offer_usage_fee numeric,
  marketing_fee_adjustment numeric,
  has_items boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '45s'
AS $$
DECLARE
  v_ids uuid[];
  v_start timestamptz := (p_start_date::timestamp) AT TIME ZONE 'UTC';
  v_end timestamptz := ((p_end_date + 1)::timestamp) AT TIME ZONE 'UTC';
  v_total bigint;
BEGIN
  SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.restaurants r
   WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
     AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Build filter as CTE-like reusable query via temp result
  CREATE TEMP TABLE IF NOT EXISTS _tmp_orders_filter (
    id uuid
  ) ON COMMIT DROP;
  DELETE FROM _tmp_orders_filter;

  INSERT INTO _tmp_orders_filter (id)
  SELECT o.id
    FROM public.orders o
   WHERE o.restaurant_id = ANY(v_ids)
     AND o.order_datetime >= v_start
     AND o.order_datetime < v_end
     AND (
       p_search IS NULL OR p_search = ''
       OR o.uber_order_id ILIKE '%' || p_search || '%'
     )
     AND (
       p_fulfillment = 'all'
       OR (p_fulfillment = 'delivery' AND (
            o.fulfillment_type ILIKE '%Livraison%'
         OR o.fulfillment_type ILIKE '%Delivery%'
         OR o.fulfillment_type ILIKE '%coursier%'
       ))
       OR (p_fulfillment = 'pickup' AND (
            o.fulfillment_type ILIKE '%emporter%'
         OR o.fulfillment_type ILIKE '%Pickup%'
       ))
     );

  SELECT count(*) INTO v_total FROM _tmp_orders_filter;

  RETURN QUERY
  WITH filtered AS (
    SELECT o.*
      FROM public.orders o
      JOIN _tmp_orders_filter f ON f.id = o.id
  )
  SELECT
    o.id,
    o.uber_order_id,
    o.order_datetime,
    o.sales_excl_vat,
    o.vat_1_sales,
    o.vat_2_sales,
    o.vat_3_sales,
    o.sales_incl_vat,
    o.uber_fee_after_promo_incl_vat,
    o.item_promo_incl_vat,
    o.refund_incl_vat,
    o.net_payout,
    o.meal_voucher_amount,
    o.promotion_discount,
    o.fulfillment_type,
    o.offer_usage_fee,
    o.vat_offer_usage_fee,
    o.marketing_fee_adjustment,
    EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id) AS has_items,
    v_total AS total_count
  FROM filtered o
  ORDER BY
    CASE WHEN p_sort_field = 'order_datetime' AND p_sort_dir = 'asc' THEN o.order_datetime END ASC,
    CASE WHEN p_sort_field = 'order_datetime' AND p_sort_dir = 'desc' THEN o.order_datetime END DESC,
    CASE WHEN p_sort_field = 'sales_incl_vat' AND p_sort_dir = 'asc' THEN o.sales_incl_vat END ASC,
    CASE WHEN p_sort_field = 'sales_incl_vat' AND p_sort_dir = 'desc' THEN o.sales_incl_vat END DESC,
    CASE WHEN p_sort_field = 'uber_fee' AND p_sort_dir = 'asc' THEN o.uber_fee_after_promo_incl_vat END ASC,
    CASE WHEN p_sort_field = 'uber_fee' AND p_sort_dir = 'desc' THEN o.uber_fee_after_promo_incl_vat END DESC,
    CASE WHEN p_sort_field = 'net_payout' AND p_sort_dir = 'asc' THEN o.net_payout END ASC,
    CASE WHEN p_sort_field = 'net_payout' AND p_sort_dir = 'desc' THEN o.net_payout END DESC,
    o.order_datetime DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;
