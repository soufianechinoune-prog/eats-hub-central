
CREATE OR REPLACE FUNCTION public.get_reviews_overview_stats(
  p_restaurant_ids uuid[],
  p_platform text,
  p_start_date date,
  p_end_date date,
  p_date_mode text DEFAULT 'review'::text
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $function$
DECLARE
  result JSON;
  v_period_days INT;
  v_prev_start DATE;
  v_prev_end DATE;
BEGIN
  -- Calculate previous period dates (same duration, shifted back)
  v_period_days := (p_end_date - p_start_date) + 1;
  v_prev_end := p_start_date - 1;
  v_prev_start := v_prev_end - v_period_days + 1;

  SELECT json_build_object(
    'avg_rating', sub.avg_rating,
    'total_count', sub.total_count,
    'tag_rate', sub.tag_rate,
    'comment_rate', sub.comment_rate,
    'rating_distribution', sub.rating_dist,
    'day_stats', sub.day_stats,
    'tag_counts', sub.tag_counts,
    'monthly_evolution', sub.monthly_evolution,
    'daily_evolution', sub.daily_evolution,
    'previous_period', sub.previous_period
  ) INTO result
  FROM (
    SELECT
      ROUND(AVG(cr.overall_rating)::numeric, 4) as avg_rating,
      COUNT(*) as total_count,
      ROUND(COUNT(*) FILTER (WHERE cr.tags IS NOT NULL AND array_length(cr.tags, 1) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) as tag_rate,
      ROUND(COUNT(*) FILTER (WHERE cr.customer_comment IS NOT NULL AND cr.customer_comment != '') * 100.0 / NULLIF(COUNT(*), 0), 1) as comment_rate,
      -- Rating distribution
      (SELECT json_object_agg(r, c) FROM (
        SELECT ROUND(cr2.overall_rating)::int as r, COUNT(*) as c
        FROM customer_reviews cr2
        WHERE cr2.restaurant_id = ANY(p_restaurant_ids)
          AND (p_platform = 'global' OR cr2.platform = p_platform)
          AND cr2.overall_rating IS NOT NULL
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr2.order_date, cr2.review_date) ELSE cr2.review_date END >= p_start_date
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr2.order_date, cr2.review_date) ELSE cr2.review_date END <= p_end_date
        GROUP BY ROUND(cr2.overall_rating)::int
      ) dist) as rating_dist,
      -- Day stats
      (SELECT json_agg(json_build_object('day_index', d, 'avg_rating', avg_r, 'count', cnt))
       FROM (
        SELECT EXTRACT(DOW FROM CASE WHEN p_date_mode = 'order' THEN COALESCE(cr3.order_date, cr3.review_date) ELSE cr3.review_date END)::int as d,
               ROUND(AVG(cr3.overall_rating)::numeric, 2) as avg_r,
               COUNT(*) as cnt
        FROM customer_reviews cr3
        WHERE cr3.restaurant_id = ANY(p_restaurant_ids)
          AND (p_platform = 'global' OR cr3.platform = p_platform)
          AND cr3.overall_rating IS NOT NULL
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr3.order_date, cr3.review_date) ELSE cr3.review_date END >= p_start_date
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr3.order_date, cr3.review_date) ELSE cr3.review_date END <= p_end_date
        GROUP BY d
       ) ds) as day_stats,
      -- Tag counts
      (SELECT json_agg(json_build_object('tag', t, 'count', tc))
       FROM (
        SELECT unnest(cr4.tags) as t, COUNT(*) as tc
        FROM customer_reviews cr4
        WHERE cr4.restaurant_id = ANY(p_restaurant_ids)
          AND (p_platform = 'global' OR cr4.platform = p_platform)
          AND cr4.tags IS NOT NULL AND array_length(cr4.tags, 1) > 0
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr4.order_date, cr4.review_date) ELSE cr4.review_date END >= p_start_date
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr4.order_date, cr4.review_date) ELSE cr4.review_date END <= p_end_date
        GROUP BY t
        ORDER BY tc DESC
       ) ts) as tag_counts,
      -- Monthly evolution
      (SELECT json_agg(json_build_object('year', y, 'month', m, 'avg_rating', avg_r, 'count', cnt) ORDER BY y, m)
       FROM (
        SELECT
          EXTRACT(YEAR FROM CASE WHEN p_date_mode = 'order' THEN COALESCE(cr5.order_date, cr5.review_date) ELSE cr5.review_date END)::int as y,
          EXTRACT(MONTH FROM CASE WHEN p_date_mode = 'order' THEN COALESCE(cr5.order_date, cr5.review_date) ELSE cr5.review_date END)::int as m,
          ROUND(AVG(cr5.overall_rating)::numeric, 2) as avg_r,
          COUNT(*) as cnt
        FROM customer_reviews cr5
        WHERE cr5.restaurant_id = ANY(p_restaurant_ids)
          AND (p_platform = 'global' OR cr5.platform = p_platform)
          AND cr5.overall_rating IS NOT NULL
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr5.order_date, cr5.review_date) ELSE cr5.review_date END >= p_start_date
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr5.order_date, cr5.review_date) ELSE cr5.review_date END <= p_end_date
        GROUP BY y, m
       ) me) as monthly_evolution,
      -- Daily evolution
      (SELECT json_agg(json_build_object('date', d, 'avg_rating', avg_r, 'count', cnt) ORDER BY d)
       FROM (
        SELECT
          (CASE WHEN p_date_mode = 'order' THEN COALESCE(cr6.order_date, cr6.review_date) ELSE cr6.review_date END)::date as d,
          ROUND(AVG(cr6.overall_rating)::numeric, 2) as avg_r,
          COUNT(*) as cnt
        FROM customer_reviews cr6
        WHERE cr6.restaurant_id = ANY(p_restaurant_ids)
          AND (p_platform = 'global' OR cr6.platform = p_platform)
          AND cr6.overall_rating IS NOT NULL
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr6.order_date, cr6.review_date) ELSE cr6.review_date END >= p_start_date
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr6.order_date, cr6.review_date) ELSE cr6.review_date END <= p_end_date
        GROUP BY d
       ) de) as daily_evolution,
      -- Previous period stats
      (SELECT json_build_object('avg_rating', prev_avg, 'total_count', prev_cnt)
       FROM (
        SELECT
          ROUND(AVG(cr7.overall_rating)::numeric, 4) as prev_avg,
          COUNT(*) as prev_cnt
        FROM customer_reviews cr7
        WHERE cr7.restaurant_id = ANY(p_restaurant_ids)
          AND (p_platform = 'global' OR cr7.platform = p_platform)
          AND cr7.overall_rating IS NOT NULL
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr7.order_date, cr7.review_date) ELSE cr7.review_date END >= v_prev_start
          AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr7.order_date, cr7.review_date) ELSE cr7.review_date END <= v_prev_end
       ) pp) as previous_period
    FROM customer_reviews cr
    WHERE cr.restaurant_id = ANY(p_restaurant_ids)
      AND (p_platform = 'global' OR cr.platform = p_platform)
      AND cr.overall_rating IS NOT NULL
      AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr.order_date, cr.review_date) ELSE cr.review_date END >= p_start_date
      AND CASE WHEN p_date_mode = 'order' THEN COALESCE(cr.order_date, cr.review_date) ELSE cr.review_date END <= p_end_date
  ) sub;

  RETURN COALESCE(result, '{}');
END;
$function$;
