
CREATE OR REPLACE FUNCTION get_products_by_time_slot(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_top_n integer DEFAULT 3
)
RETURNS TABLE (
  slot_label text,
  slot_range text,
  product_title text,
  quantity bigint,
  revenue numeric,
  percent_of_slot numeric,
  rank integer,
  slot_total_orders bigint,
  slot_total_revenue numeric
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH order_slots AS (
    SELECT 
      o.id as order_id,
      EXTRACT(HOUR FROM o.order_datetime) as hour,
      CASE 
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 11 AND 14 THEN 'Déjeuner'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 15 AND 17 THEN 'Après-midi'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 18 AND 21 THEN 'Dîner'
        WHEN EXTRACT(HOUR FROM o.order_datetime) IN (22, 23) THEN 'Soirée'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 0 AND 3 THEN 'Late-night'
        ELSE NULL
      END as slot_label,
      CASE 
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 11 AND 14 THEN '11h-15h'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 15 AND 17 THEN '15h-18h'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 18 AND 21 THEN '18h-22h'
        WHEN EXTRACT(HOUR FROM o.order_datetime) IN (22, 23) THEN '22h-00h'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 0 AND 3 THEN '00h-04h'
        ELSE NULL
      END as slot_range
    FROM orders o
    WHERE o.restaurant_id = ANY(p_restaurant_ids)
      AND o.order_datetime::date BETWEEN p_start_date AND p_end_date
      AND o.order_datetime IS NOT NULL
  ),
  product_agg AS (
    SELECT 
      os.slot_label,
      os.slot_range,
      oi.item_title as product_title,
      SUM(oi.quantity) as quantity,
      SUM(COALESCE(oi.sales_excl_vat, 0) + COALESCE(oi.tax_amount, 0)) as revenue
    FROM order_slots os
    JOIN order_items oi ON oi.order_id = os.order_id
    WHERE os.slot_label IS NOT NULL
    GROUP BY os.slot_label, os.slot_range, oi.item_title
  ),
  slot_totals AS (
    SELECT 
      os.slot_label,
      SUM(oi.quantity) as total_qty,
      SUM(COALESCE(oi.sales_excl_vat, 0) + COALESCE(oi.tax_amount, 0)) as total_revenue,
      COUNT(DISTINCT os.order_id) as total_orders
    FROM order_slots os
    JOIN order_items oi ON oi.order_id = os.order_id
    WHERE os.slot_label IS NOT NULL
    GROUP BY os.slot_label
  ),
  ranked AS (
    SELECT 
      pa.*,
      st.total_orders,
      st.total_revenue as slot_total,
      ROUND(pa.revenue * 100.0 / NULLIF(st.total_revenue, 0), 0) as pct,
      ROW_NUMBER() OVER (PARTITION BY pa.slot_label ORDER BY pa.revenue DESC) as rn
    FROM product_agg pa
    JOIN slot_totals st ON st.slot_label = pa.slot_label
  )
  SELECT 
    r.slot_label,
    r.slot_range,
    r.product_title,
    r.quantity,
    r.revenue,
    r.pct as percent_of_slot,
    r.rn::integer as rank,
    r.total_orders as slot_total_orders,
    r.slot_total as slot_total_revenue
  FROM ranked r
  WHERE r.rn <= p_top_n
  ORDER BY 
    CASE r.slot_label 
      WHEN 'Déjeuner' THEN 1
      WHEN 'Après-midi' THEN 2
      WHEN 'Dîner' THEN 3
      WHEN 'Soirée' THEN 4
      WHEN 'Late-night' THEN 5
    END,
    r.rn;
END;
$$;
