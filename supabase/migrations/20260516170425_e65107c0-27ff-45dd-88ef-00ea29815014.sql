CREATE OR REPLACE FUNCTION public.get_ads_revenue_ratio(
  p_start_date date,
  p_end_date   date,
  p_restaurant_ids uuid[]
) RETURNS TABLE (
  restaurant_id uuid,
  ads_spend     numeric,
  revenue_ttc   numeric,
  ads_pct       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ads AS (
    SELECT pa.restaurant_id, COALESCE(SUM(pa.amount), 0) AS amount_sum
    FROM public.payout_adjustments pa
    WHERE pa.category = 'advertising'
      AND pa.restaurant_id = ANY(p_restaurant_ids)
      AND pa.payout_date BETWEEN p_start_date AND p_end_date
    GROUP BY pa.restaurant_id
  ),
  rev AS (
    SELECT o.restaurant_id, COALESCE(SUM(o.sales_incl_vat), 0) AS revenue
    FROM public.orders o
    WHERE o.restaurant_id = ANY(p_restaurant_ids)
      AND (o.order_datetime AT TIME ZONE 'Europe/Paris')::date BETWEEN p_start_date AND p_end_date
    GROUP BY o.restaurant_id
  ),
  joined AS (
    SELECT r_id AS restaurant_id,
           COALESCE(ABS(ads.amount_sum), 0)::numeric AS ads_spend,
           COALESCE(rev.revenue, 0)::numeric         AS revenue_ttc
    FROM unnest(p_restaurant_ids) AS r_id
    LEFT JOIN ads ON ads.restaurant_id = r_id
    LEFT JOIN rev ON rev.restaurant_id = r_id
  )
  SELECT
    j.restaurant_id,
    j.ads_spend,
    j.revenue_ttc,
    CASE WHEN j.revenue_ttc > 0
         THEN ROUND((j.ads_spend / j.revenue_ttc) * 100, 2)
         ELSE NULL
    END AS ads_pct
  FROM joined j
  WHERE j.ads_spend > 0 OR j.revenue_ttc > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_ads_revenue_ratio(date, date, uuid[]) TO authenticated;