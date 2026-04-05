CREATE OR REPLACE FUNCTION public.get_network_ratings_summary(
  p_restaurant_ids UUID[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  restaurant_id UUID,
  avg_rating NUMERIC,
  review_count BIGINT,
  platform TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET statement_timeout = '10s'
AS $$
  SELECT
    cr.restaurant_id,
    ROUND(AVG(cr.overall_rating)::numeric, 2) as avg_rating,
    COUNT(*) as review_count,
    cr.platform
  FROM public.customer_reviews cr
  WHERE cr.restaurant_id = ANY(p_restaurant_ids)
    AND cr.review_date >= p_start_date
    AND cr.review_date <= p_end_date
    AND cr.overall_rating IS NOT NULL
  GROUP BY cr.restaurant_id, cr.platform;
$$;