-- Index pour optimiser les requêtes d'agrégation
CREATE INDEX IF NOT EXISTS idx_orders_datetime_restaurant 
ON orders(order_datetime, restaurant_id);

-- Fonction pour agrégation journalière depuis orders
CREATE OR REPLACE FUNCTION get_daily_revenue_from_orders(
  p_start_date DATE,
  p_end_date DATE,
  p_restaurant_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  restaurant_id UUID,
  date DATE,
  platform TEXT,
  revenue_ttc NUMERIC,
  order_count BIGINT,
  average_basket NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.restaurant_id,
    DATE(o.order_datetime) as date,
    'uber_eats'::TEXT as platform,
    COALESCE(SUM(o.sales_incl_vat), 0) as revenue_ttc,
    COUNT(*) as order_count,
    CASE WHEN COUNT(*) > 0 
      THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2)
      ELSE 0 
    END as average_basket
  FROM orders o
  WHERE o.order_datetime >= p_start_date
    AND o.order_datetime < p_end_date + INTERVAL '1 day'
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY o.restaurant_id, DATE(o.order_datetime)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction pour agrégation mensuelle depuis orders
CREATE OR REPLACE FUNCTION get_monthly_revenue_from_orders(
  p_year INTEGER,
  p_restaurant_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  restaurant_id UUID,
  year INTEGER,
  month INTEGER,
  platform TEXT,
  revenue_ttc NUMERIC,
  order_count BIGINT,
  average_basket NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.restaurant_id,
    EXTRACT(YEAR FROM o.order_datetime)::INTEGER as year,
    EXTRACT(MONTH FROM o.order_datetime)::INTEGER as month,
    'uber_eats'::TEXT as platform,
    COALESCE(SUM(o.sales_incl_vat), 0) as revenue_ttc,
    COUNT(*) as order_count,
    CASE WHEN COUNT(*) > 0 
      THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2)
      ELSE 0 
    END as average_basket
  FROM orders o
  WHERE EXTRACT(YEAR FROM o.order_datetime) = p_year
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY o.restaurant_id, EXTRACT(YEAR FROM o.order_datetime), EXTRACT(MONTH FROM o.order_datetime)
  ORDER BY month;
END;
$$ LANGUAGE plpgsql STABLE;