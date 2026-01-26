-- Create RPC function for BOGO historical sales aggregation
-- This performs server-side aggregation with fuzzy matching to bypass client limitations

CREATE OR REPLACE FUNCTION public.get_bogo_historical_sales(
  p_item_names TEXT[],
  p_restaurant_ids UUID[],
  p_start_date TIMESTAMPTZ,
  p_period_days INTEGER
) 
RETURNS TABLE (
  total_quantity BIGINT,
  total_sales NUMERIC,
  avg_per_day NUMERIC,
  avg_sales_per_day NUMERIC,
  matched_items_count BIGINT,
  period_days INTEGER
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_normalized_names TEXT[];
  v_name TEXT;
BEGIN
  -- Normalize all input item names for matching
  v_normalized_names := ARRAY[]::TEXT[];
  FOREACH v_name IN ARRAY p_item_names
  LOOP
    v_normalized_names := array_append(
      v_normalized_names, 
      LOWER(REGEXP_REPLACE(v_name, '[^a-zA-Z0-9 ]', '', 'g'))
    );
  END LOOP;

  RETURN QUERY
  WITH matched_items AS (
    SELECT 
      oi.id,
      oi.quantity,
      oi.sales_incl_vat,
      oi.item_title
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE 
      -- Date filter
      (p_start_date IS NULL OR o.order_datetime >= p_start_date)
      -- Restaurant filter (empty array = all restaurants)
      AND (CARDINALITY(p_restaurant_ids) = 0 OR o.restaurant_id = ANY(p_restaurant_ids))
      -- Fuzzy name matching: normalized title contains any normalized name or vice versa
      AND EXISTS (
        SELECT 1 FROM unnest(v_normalized_names) AS normalized_name
        WHERE 
          LOWER(REGEXP_REPLACE(oi.item_title, '[^a-zA-Z0-9 ]', '', 'g')) 
            ILIKE '%' || normalized_name || '%'
          OR normalized_name 
            ILIKE '%' || LOWER(REGEXP_REPLACE(oi.item_title, '[^a-zA-Z0-9 ]', '', 'g')) || '%'
      )
      -- Only count items with positive data
      AND (oi.quantity > 0 OR COALESCE(oi.sales_incl_vat, 0) > 0)
  )
  SELECT 
    COALESCE(SUM(mi.quantity), 0)::BIGINT as total_quantity,
    COALESCE(SUM(mi.sales_incl_vat), 0)::NUMERIC as total_sales,
    ROUND(COALESCE(SUM(mi.quantity), 0)::NUMERIC / NULLIF(p_period_days, 0), 1) as avg_per_day,
    ROUND(COALESCE(SUM(mi.sales_incl_vat), 0) / NULLIF(p_period_days, 0), 2) as avg_sales_per_day,
    COUNT(DISTINCT mi.item_title)::BIGINT as matched_items_count,
    p_period_days as period_days
  FROM matched_items mi;
END;
$$;