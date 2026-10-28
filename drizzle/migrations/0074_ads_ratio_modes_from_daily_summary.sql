CREATE OR REPLACE FUNCTION public.get_ads_revenue_ratio_modes(p_start_date date, p_end_date date, p_restaurant_ids uuid[])
RETURNS TABLE(restaurant_id uuid, ads_spend_ht numeric, revenue_net_ttc numeric, revenue_net_ht numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
WITH allowed AS (
  SELECT r.id FROM public.restaurants r
  WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
), ads AS (
  SELECT pa.restaurant_id, ABS(COALESCE(SUM(pa.amount),0)) AS a
  FROM public.payout_adjustments pa
  WHERE pa.category='advertising' AND pa.restaurant_id IN (SELECT id FROM allowed)
    AND pa.payout_date BETWEEN p_start_date AND p_end_date + 1
    AND public.ads_reporting_date(pa.payout_date) BETWEEN p_start_date AND p_end_date
  GROUP BY pa.restaurant_id
), rev AS (
  -- Same source and 4h business-day cutoff as get_ads_quarterly_summary
  SELECT s.restaurant_id,
    COALESCE(SUM(s.sales_incl_vat - s.item_promo_incl_vat_abs),0) AS ttc,
    COALESCE(SUM(s.rev_net_ht),0) AS ht
  FROM public.orders_daily_summary s
  WHERE s.restaurant_id IN (SELECT id FROM allowed) AND s.day BETWEEN p_start_date AND p_end_date
  GROUP BY s.restaurant_id
)
SELECT al.id, COALESCE(ads.a,0), COALESCE(rev.ttc,0), COALESCE(rev.ht,0)
FROM allowed al LEFT JOIN ads ON ads.restaurant_id=al.id LEFT JOIN rev ON rev.restaurant_id=al.id
WHERE COALESCE(ads.a,0)>0 OR COALESCE(rev.ttc,0)>0;
$$;