DROP FUNCTION IF EXISTS public.get_ads_efficiency(date,date,date,date,uuid[]);
CREATE OR REPLACE FUNCTION public.get_ads_efficiency(p_start date, p_end date, p_prev_start date, p_prev_end date, p_restaurant_ids uuid[])
RETURNS TABLE(restaurant_id uuid, ads_ht numeric, rev_ttc numeric, rev_prev_ttc numeric, payout numeric, payout_prev numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
WITH allowed AS (
  SELECT r.id FROM public.restaurants r
  WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
), ads AS (
  SELECT pa.restaurant_id, ABS(COALESCE(SUM(pa.amount),0)) AS a
  FROM public.payout_adjustments pa
  WHERE pa.category='advertising' AND pa.restaurant_id IN (SELECT id FROM allowed)
    AND pa.payout_date BETWEEN p_start AND p_end + 1
    AND public.ads_reporting_date(pa.payout_date) BETWEEN p_start AND p_end
  GROUP BY pa.restaurant_id
), cur AS (
  SELECT s.restaurant_id, SUM(s.sales_incl_vat - s.item_promo_incl_vat_abs) AS ttc, SUM(s.net_payout + s.meal_voucher) AS pay
  FROM public.orders_daily_summary s
  WHERE s.restaurant_id IN (SELECT id FROM allowed) AND s.day BETWEEN p_start AND p_end
  GROUP BY s.restaurant_id
), prev AS (
  SELECT s.restaurant_id, SUM(s.sales_incl_vat - s.item_promo_incl_vat_abs) AS ttc, SUM(s.net_payout + s.meal_voucher) AS pay
  FROM public.orders_daily_summary s
  WHERE s.restaurant_id IN (SELECT id FROM allowed) AND s.day BETWEEN p_prev_start AND p_prev_end
  GROUP BY s.restaurant_id
)
SELECT al.id, COALESCE(ads.a,0)::numeric, COALESCE(cur.ttc,0)::numeric, COALESCE(prev.ttc,0)::numeric, COALESCE(cur.pay,0)::numeric, COALESCE(prev.pay,0)::numeric
FROM allowed al LEFT JOIN ads ON ads.restaurant_id=al.id LEFT JOIN cur ON cur.restaurant_id=al.id LEFT JOIN prev ON prev.restaurant_id=al.id
WHERE COALESCE(cur.ttc,0)>0 OR COALESCE(prev.ttc,0)>0;
$$;
GRANT EXECUTE ON FUNCTION public.get_ads_efficiency(date,date,date,date,uuid[]) TO authenticated;