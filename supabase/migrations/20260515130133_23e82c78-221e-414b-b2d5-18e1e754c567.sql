CREATE OR REPLACE FUNCTION public.parse_uber_csv_numeric(_value text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _value IS NULL OR btrim(_value) = '' THEN 0::numeric
    WHEN regexp_replace(replace(replace(replace(_value, chr(160), ' '), '€', ''), ',', '.'), '\s', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN regexp_replace(replace(replace(replace(_value, chr(160), ' '), '€', ''), ',', '.'), '\s', '', 'g')::numeric
    ELSE 0::numeric
  END;
$$;

CREATE OR REPLACE FUNCTION public.parse_uber_csv_date(_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  parts text[];
  y text;
BEGIN
  IF _value IS NULL OR btrim(_value) = '' THEN
    RETURN NULL;
  END IF;

  IF btrim(_value) !~ '^\d{1,2}/\d{1,2}/\d{2,4}$' THEN
    RETURN NULL;
  END IF;

  parts := regexp_split_to_array(btrim(_value), '/');
  y := parts[3];
  IF length(y) = 2 THEN
    y := '20' || y;
  END IF;

  RETURN make_date(y::int, parts[2]::int, parts[1]::int);
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_network_orders_summary(
  p_restaurant_ids uuid[], p_start_date date, p_end_date date
)
RETURNS TABLE(
  restaurant_id uuid,
  total_sales_incl_vat numeric,
  total_net_payout numeric,
  total_item_promo_incl_vat numeric,
  total_meal_voucher numeric,
  order_count bigint
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  WITH order_summary AS (
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
    GROUP BY o.restaurant_id
  ),
  adjustment_rows AS (
    SELECT
      pa.restaurant_id,
      pa.amount,
      COALESCE(
        public.parse_uber_csv_date(pa.raw_columns->>'Date locale à laquelle la commande a été passée ou date locale de la commande d''origine passée pour laquelle un remboursement a été effectué'),
        public.parse_uber_csv_date(pa.raw_columns->>'Date de la commande'),
        pa.payout_date
      ) AS report_date,
      public.parse_uber_csv_numeric(pa.raw_columns->>'Versement par l''entité tierce de titres-restaurant, p. ex., Edenred, Swile, etc.') AS meal_voucher_adjustment
    FROM public.payout_adjustments pa
    WHERE pa.restaurant_id = ANY(p_restaurant_ids)
  ),
  adjustment_summary AS (
    SELECT
      ar.restaurant_id,
      COALESCE(SUM(ar.amount), 0)::numeric AS total_adjustments,
      COALESCE(SUM(ar.meal_voucher_adjustment), 0)::numeric AS total_meal_voucher_adjustments
    FROM adjustment_rows ar
    WHERE ar.report_date >= p_start_date
      AND ar.report_date <= p_end_date
    GROUP BY ar.restaurant_id
  )
  SELECT
    COALESCE(os.restaurant_id, ads.restaurant_id) AS restaurant_id,
    COALESCE(os.total_sales_incl_vat, 0)::numeric AS total_sales_incl_vat,
    (COALESCE(os.total_net_payout, 0) + COALESCE(ads.total_adjustments, 0))::numeric AS total_net_payout,
    COALESCE(os.total_item_promo_incl_vat, 0)::numeric AS total_item_promo_incl_vat,
    (COALESCE(os.total_meal_voucher, 0) + COALESCE(ads.total_meal_voucher_adjustments, 0))::numeric AS total_meal_voucher,
    COALESCE(os.order_count, 0)::bigint AS order_count
  FROM order_summary os
  FULL OUTER JOIN adjustment_summary ads ON ads.restaurant_id = os.restaurant_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_network_orders_summary(uuid[], date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_network_orders_summary(uuid[], date, date) TO authenticated;