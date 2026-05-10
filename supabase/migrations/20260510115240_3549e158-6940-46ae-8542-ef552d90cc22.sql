-- Index concurrent pour ne pas bloquer la table en prod
CREATE INDEX IF NOT EXISTS idx_orders_data_source
  ON public.orders (restaurant_id, data_source);

CREATE OR REPLACE FUNCTION public.get_orders_data_source_breakdown(
  p_restaurant_ids UUID[],
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  restaurant_id UUID,
  data_source TEXT,
  order_count BIGINT,
  revenue NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.restaurant_id,
    COALESCE(o.data_source, 'csv_import') AS data_source,
    COUNT(*)::BIGINT AS order_count,
    COALESCE(SUM(o.gross_amount), 0)::NUMERIC AS revenue
  FROM public.orders o
  WHERE o.restaurant_id = ANY(p_restaurant_ids)
    AND o.order_datetime >= p_start_date
    AND o.order_datetime <= p_end_date
  GROUP BY o.restaurant_id, o.data_source;
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_data_source_breakdown(UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
