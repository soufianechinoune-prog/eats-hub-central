CREATE OR REPLACE FUNCTION public.get_product_sales_for_period(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_restaurant_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  item_title TEXT,
  total_quantity BIGINT
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.item_title,
    SUM(oi.quantity)::BIGINT as total_quantity
  FROM public.order_items oi
  JOIN public.orders o ON oi.order_id = o.id
  WHERE 
    (p_start_date IS NULL OR o.order_datetime >= p_start_date)
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY oi.item_title
  ORDER BY total_quantity DESC;
END;
$$;