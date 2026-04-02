CREATE OR REPLACE FUNCTION public.get_product_sales_for_period(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(item_title text, total_quantity bigint)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  SELECT oi.item_title, SUM(oi.quantity)::BIGINT as total_quantity
  FROM public.order_items oi
  JOIN public.orders o ON oi.order_id = o.id
  WHERE (p_start_date IS NULL OR o.order_datetime >= p_start_date)
    AND (p_end_date IS NULL OR o.order_datetime <= p_end_date)
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY oi.item_title
  ORDER BY total_quantity DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_network_prep_time_summary(
  p_restaurant_ids uuid[],
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE(restaurant_id uuid, avg_prep_time numeric, avg_total_delivery_time numeric, avg_avoidable_wait_time numeric, prep_count bigint, delivery_count bigint, avoidable_wait_count bigint)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oh.restaurant_id,
    ROUND(AVG(oh.initial_prep_time_minutes) FILTER (WHERE oh.initial_prep_time_minutes IS NOT NULL), 2),
    ROUND(AVG(oh.total_prep_delivery_time_minutes) FILTER (WHERE oh.total_prep_delivery_time_minutes IS NOT NULL), 2),
    ROUND(AVG(oh.avoidable_wait_time_minutes) FILTER (WHERE oh.avoidable_wait_time_minutes IS NOT NULL), 2),
    COUNT(*) FILTER (WHERE oh.initial_prep_time_minutes IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE oh.total_prep_delivery_time_minutes IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE oh.avoidable_wait_time_minutes IS NOT NULL)::bigint
  FROM public.order_history oh
  WHERE oh.restaurant_id = ANY(p_restaurant_ids)
    AND oh.order_datetime >= p_start_date
    AND oh.order_datetime <= p_end_date
  GROUP BY oh.restaurant_id;
END;
$$;