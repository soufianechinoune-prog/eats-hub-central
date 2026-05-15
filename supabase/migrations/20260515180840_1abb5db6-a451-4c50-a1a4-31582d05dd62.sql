CREATE OR REPLACE FUNCTION public.get_uber_one_stats(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_restaurant_ids uuid[],
  p_platform text DEFAULT NULL::text,
  p_granularity text DEFAULT 'monthly'::text
)
RETURNS TABLE(
  period_key text,
  restaurant_id uuid,
  uber_one_count bigint,
  non_uber_one_count bigint,
  uber_one_revenue numeric,
  non_uber_one_revenue numeric,
  uber_one_prep_sum numeric,
  non_uber_one_prep_sum numeric,
  uber_one_prep_count bigint,
  non_uber_one_prep_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  WITH unified AS (
    -- Source 1: order_history (CSV imports) — full data including prep time
    SELECT
      oh.order_datetime,
      oh.restaurant_id,
      oh.platform,
      (oh.uber_one = true) AS is_uber_one,
      oh.order_amount AS amount,
      oh.initial_prep_time_minutes AS prep_time
    FROM public.order_history oh
    WHERE oh.restaurant_id = ANY(p_restaurant_ids)
      AND oh.order_datetime >= p_start_date
      AND oh.order_datetime <= p_end_date
      AND (p_platform IS NULL OR oh.platform = p_platform)

    UNION ALL

    -- Source 2: orders (API) — fallback, dedupe by uber_order_id, uber_eats only
    SELECT
      o.order_datetime,
      o.restaurant_id,
      'uber_eats'::text AS platform,
      (o.uber_one_status = 'Membre Uber One') AS is_uber_one,
      o.sales_incl_vat AS amount,
      NULL::numeric AS prep_time
    FROM public.orders o
    WHERE o.restaurant_id = ANY(p_restaurant_ids)
      AND o.order_datetime >= p_start_date
      AND o.order_datetime <= p_end_date
      AND o.uber_one_status IS NOT NULL
      AND (p_platform IS NULL OR p_platform = 'uber_eats')
      AND NOT EXISTS (
        SELECT 1 FROM public.order_history oh2
        WHERE oh2.uber_order_id = o.uber_order_id
          AND oh2.restaurant_id = o.restaurant_id
      )
  )
  SELECT
    CASE
      WHEN p_granularity = 'daily' THEN to_char(u.order_datetime::date, 'YYYY-MM-DD')
      ELSE to_char(u.order_datetime::date, 'YYYY-MM')
    END AS period_key,
    u.restaurant_id,
    COUNT(*) FILTER (WHERE u.is_uber_one)::bigint AS uber_one_count,
    COUNT(*) FILTER (WHERE NOT u.is_uber_one)::bigint AS non_uber_one_count,
    COALESCE(SUM(u.amount) FILTER (WHERE u.is_uber_one), 0)::numeric AS uber_one_revenue,
    COALESCE(SUM(u.amount) FILTER (WHERE NOT u.is_uber_one), 0)::numeric AS non_uber_one_revenue,
    COALESCE(SUM(u.prep_time) FILTER (WHERE u.is_uber_one AND u.prep_time IS NOT NULL), 0)::numeric AS uber_one_prep_sum,
    COALESCE(SUM(u.prep_time) FILTER (WHERE NOT u.is_uber_one AND u.prep_time IS NOT NULL), 0)::numeric AS non_uber_one_prep_sum,
    COUNT(*) FILTER (WHERE u.is_uber_one AND u.prep_time IS NOT NULL)::bigint AS uber_one_prep_count,
    COUNT(*) FILTER (WHERE NOT u.is_uber_one AND u.prep_time IS NOT NULL)::bigint AS non_uber_one_prep_count
  FROM unified u
  GROUP BY
    CASE
      WHEN p_granularity = 'daily' THEN to_char(u.order_datetime::date, 'YYYY-MM-DD')
      ELSE to_char(u.order_datetime::date, 'YYYY-MM')
    END,
    u.restaurant_id;
END;
$function$;