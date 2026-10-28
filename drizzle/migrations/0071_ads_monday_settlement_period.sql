-- Reporting convention approved for advertising: a Monday settlement belongs
-- to the preceding week, represented by its Sunday. Other dates are unchanged.
-- Do not modify source rows, parser deduplication or J-14 / J-8 backfill.
CREATE OR REPLACE FUNCTION public.ads_reporting_date(p_payout_date date)
RETURNS date LANGUAGE sql IMMUTABLE STRICT SET search_path = public
AS $$ SELECT CASE WHEN EXTRACT(ISODOW FROM p_payout_date) = 1 THEN p_payout_date - 1 ELSE p_payout_date END $$;
REVOKE ALL ON FUNCTION public.ads_reporting_date(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ads_reporting_date(date) TO authenticated, service_role;
COMMENT ON FUNCTION public.ads_reporting_date(date) IS 'Advertising reporting convention: Monday settlement assigned to preceding Sunday/week; not a reconstructed daily service date.';
DO $$ BEGIN
  IF public.ads_reporting_date(DATE '2026-10-26') <> DATE '2026-10-25' THEN RAISE EXCEPTION 'Monday must belong to preceding week'; END IF;
  IF public.ads_reporting_date(DATE '2026-10-19') <> DATE '2026-10-18' THEN RAISE EXCEPTION 'Previous Monday must not remain in October 19-25'; END IF;
  IF public.ads_reporting_date(DATE '2026-10-20') <> DATE '2026-10-20' THEN RAISE EXCEPTION 'Non-Monday settlements must not move'; END IF;
  IF public.ads_reporting_date(DATE '2027-01-04') <> DATE '2027-01-03' THEN RAISE EXCEPTION 'Year boundary must preserve preceding week'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.get_ads_revenue_ratio_modes(p_start_date date, p_end_date date, p_restaurant_ids uuid[])
RETURNS TABLE(restaurant_id uuid, ads_spend_ht numeric, revenue_net_ttc numeric, revenue_net_ht numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '20s'
AS $$
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
  SELECT o.restaurant_id,
    COALESCE(SUM(COALESCE(o.sales_incl_vat,0)+COALESCE(o.item_promo_incl_vat,0)),0) AS ttc,
    COALESCE(SUM(COALESCE(o.sales_excl_vat,0)+COALESCE(o.item_promo_excl_vat,0)),0) AS ht
  FROM public.orders o
  WHERE o.restaurant_id IN (SELECT id FROM allowed)
    AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime < ((p_end_date + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id
)
SELECT al.id, COALESCE(ads.a,0), COALESCE(rev.ttc,0), COALESCE(rev.ht,0)
FROM allowed al LEFT JOIN ads ON ads.restaurant_id=al.id LEFT JOIN rev ON rev.restaurant_id=al.id
WHERE COALESCE(ads.a,0)>0 OR COALESCE(rev.ttc,0)>0;
$$;
REVOKE ALL ON FUNCTION public.get_ads_revenue_ratio_modes(date,date,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ads_revenue_ratio_modes(date,date,uuid[]) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_ads_revenue_ratio(p_start_date date, p_end_date date, p_restaurant_ids uuid[])
RETURNS TABLE(restaurant_id uuid, ads_spend numeric, revenue_ttc numeric, ads_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '20s'
AS $$
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
  SELECT o.restaurant_id, COALESCE(SUM(o.sales_incl_vat),0) AS revenue
  FROM public.orders o
  WHERE o.restaurant_id IN (SELECT id FROM allowed)
    AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime < ((p_end_date + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id
)
SELECT al.id, COALESCE(ads.a,0), COALESCE(rev.revenue,0),
  CASE WHEN rev.revenue>0 THEN ROUND(COALESCE(ads.a,0)/rev.revenue*100,2) ELSE NULL END
FROM allowed al LEFT JOIN ads ON ads.restaurant_id=al.id LEFT JOIN rev ON rev.restaurant_id=al.id
WHERE COALESCE(ads.a,0)>0 OR COALESCE(rev.revenue,0)>0;
$$;
REVOKE ALL ON FUNCTION public.get_ads_revenue_ratio(date,date,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ads_revenue_ratio(date,date,uuid[]) TO authenticated, service_role;