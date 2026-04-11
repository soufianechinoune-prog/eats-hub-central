
CREATE OR REPLACE FUNCTION public.get_wait_time_daily(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_platform text DEFAULT NULL,
  p_mode text DEFAULT 'both'
)
RETURNS TABLE(
  restaurant_id uuid,
  day date,
  hour integer,
  avg_avoidable_wait numeric,
  avg_courier_wait numeric,
  orders_with_avoidable bigint,
  orders_with_courier_wait bigint,
  total_orders bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
BEGIN
  IF p_mode = 'daily' OR p_mode = 'both' THEN
    RETURN QUERY
    SELECT
      oh.restaurant_id,
      oh.order_datetime::date AS day,
      NULL::integer AS hour,
      ROUND(AVG(oh.avoidable_wait_time_minutes) FILTER (WHERE oh.avoidable_wait_time_minutes > 0), 2) AS avg_avoidable_wait,
      ROUND(AVG(oh.courier_wait_time_minutes) FILTER (WHERE oh.courier_wait_time_minutes > 0), 2) AS avg_courier_wait,
      COUNT(*) FILTER (WHERE oh.avoidable_wait_time_minutes IS NOT NULL AND oh.avoidable_wait_time_minutes > 0) AS orders_with_avoidable,
      COUNT(*) FILTER (WHERE oh.courier_wait_time_minutes IS NOT NULL AND oh.courier_wait_time_minutes > 0) AS orders_with_courier_wait,
      COUNT(*) AS total_orders
    FROM order_history oh
    WHERE oh.restaurant_id = ANY(p_restaurant_ids)
      AND oh.order_datetime::date BETWEEN p_start_date AND p_end_date
      AND (p_platform IS NULL OR oh.platform = p_platform)
    GROUP BY oh.restaurant_id, oh.order_datetime::date;
  END IF;

  IF p_mode = 'hourly' OR p_mode = 'both' THEN
    RETURN QUERY
    SELECT
      oh.restaurant_id,
      oh.order_datetime::date AS day,
      EXTRACT(HOUR FROM oh.order_datetime)::integer AS hour,
      ROUND(AVG(oh.avoidable_wait_time_minutes) FILTER (WHERE oh.avoidable_wait_time_minutes > 0), 2) AS avg_avoidable_wait,
      ROUND(AVG(oh.courier_wait_time_minutes) FILTER (WHERE oh.courier_wait_time_minutes > 0), 2) AS avg_courier_wait,
      COUNT(*) FILTER (WHERE oh.avoidable_wait_time_minutes IS NOT NULL AND oh.avoidable_wait_time_minutes > 0) AS orders_with_avoidable,
      COUNT(*) FILTER (WHERE oh.courier_wait_time_minutes IS NOT NULL AND oh.courier_wait_time_minutes > 0) AS orders_with_courier_wait,
      COUNT(*) AS total_orders
    FROM order_history oh
    WHERE oh.restaurant_id = ANY(p_restaurant_ids)
      AND oh.order_datetime::date BETWEEN p_start_date AND p_end_date
      AND (p_platform IS NULL OR oh.platform = p_platform)
    GROUP BY oh.restaurant_id, oh.order_datetime::date, EXTRACT(HOUR FROM oh.order_datetime)::integer;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_total_delivery_time_daily(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_platform text DEFAULT NULL,
  p_mode text DEFAULT 'both'
)
RETURNS TABLE(
  restaurant_id uuid,
  day date,
  hour integer,
  avg_time numeric,
  min_time numeric,
  max_time numeric,
  order_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
BEGIN
  IF p_mode = 'daily' OR p_mode = 'both' THEN
    RETURN QUERY
    SELECT
      oh.restaurant_id,
      oh.order_datetime::date AS day,
      NULL::integer AS hour,
      ROUND(AVG(oh.total_prep_delivery_time_minutes), 2) AS avg_time,
      ROUND(MIN(oh.total_prep_delivery_time_minutes), 2) AS min_time,
      ROUND(MAX(oh.total_prep_delivery_time_minutes), 2) AS max_time,
      COUNT(*) AS order_count
    FROM order_history oh
    WHERE oh.restaurant_id = ANY(p_restaurant_ids)
      AND oh.order_datetime::date BETWEEN p_start_date AND p_end_date
      AND oh.total_prep_delivery_time_minutes IS NOT NULL
      AND (p_platform IS NULL OR oh.platform = p_platform)
    GROUP BY oh.restaurant_id, oh.order_datetime::date;
  END IF;

  IF p_mode = 'hourly' OR p_mode = 'both' THEN
    RETURN QUERY
    SELECT
      oh.restaurant_id,
      oh.order_datetime::date AS day,
      EXTRACT(HOUR FROM oh.order_datetime)::integer AS hour,
      ROUND(AVG(oh.total_prep_delivery_time_minutes), 2) AS avg_time,
      ROUND(MIN(oh.total_prep_delivery_time_minutes), 2) AS min_time,
      ROUND(MAX(oh.total_prep_delivery_time_minutes), 2) AS max_time,
      COUNT(*) AS order_count
    FROM order_history oh
    WHERE oh.restaurant_id = ANY(p_restaurant_ids)
      AND oh.order_datetime::date BETWEEN p_start_date AND p_end_date
      AND oh.total_prep_delivery_time_minutes IS NOT NULL
      AND (p_platform IS NULL OR oh.platform = p_platform)
    GROUP BY oh.restaurant_id, oh.order_datetime::date, EXTRACT(HOUR FROM oh.order_datetime)::integer;
  END IF;
END;
$$;
