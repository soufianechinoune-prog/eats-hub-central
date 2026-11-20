-- Dépenses pub / CA : filtrer le réseau et les dates AVANT d'écarter les doublons.
--
-- Constat du 20/11/2026 (Chicken Street, 2026) : 3,5 s, jusqu'à 20 s sous charge, carte « Aucune donnée »
-- quand le calcul abandonnait. La vue ads_advertising_lines classait TOUTES les lignes pub de toutes les
-- enseignes (dense_rank) avant que la fonction ne garde son réseau et sa période.
--
-- 1. Vue : payout_date ajoutée au découpage du classement. Résultat identique (une référence de versement
--    a toujours une seule date : 0 exception sur 52 005 lignes pub ; contrôle 20/11 : 54 605 lignes et
--    −2 414 921,88 € pour CS, avant comme après). Postgres peut alors appliquer le filtre de dates
--    avant le classement.
-- 2. get_ads_revenue_ratio_modes : restaurant_id = ANY(tableau) au lieu d'une sous-requête IN, pour que le
--    filtre réseau passe lui aussi avant le classement. 3,5 s → 0,55 s mesurés.

CREATE OR REPLACE VIEW public.ads_advertising_lines WITH (security_invoker = true) AS
 SELECT d.restaurant_id,
    d.payout_reference_id,
    d.payout_date,
    d.amount,
    d.category,
    'raw'::text AS source_kind
   FROM ( SELECT l.restaurant_id,
            l.payout_reference_id,
            l.payout_date,
            l.amount,
            l.category,
            dense_rank() OVER (PARTITION BY l.restaurant_id, l.payout_reference_id, l.payout_date, (round(l.amount, 2)), (COALESCE(l.raw_columns ->> 'Date de la commande'::text, ''::text)) ORDER BY l.source_report_hash NULLS FIRST) AS report_rank
           FROM payout_adjustment_lines l
          WHERE l.category = 'advertising'::text AND l.source_duplicate_of IS NULL) d
  WHERE d.report_rank = 1
UNION ALL
 SELECT a.restaurant_id,
    a.payout_reference_id,
    a.payout_date,
    a.amount,
    a.category,
    'legacy'::text AS source_kind
   FROM payout_adjustments a
  WHERE a.category = 'advertising'::text AND NOT (EXISTS ( SELECT 1
           FROM payout_adjustment_lines l2
          WHERE l2.restaurant_id = a.restaurant_id AND l2.payout_reference_id = a.payout_reference_id AND l2.source_duplicate_of IS NULL));

CREATE OR REPLACE FUNCTION public.get_ads_revenue_ratio_modes(p_start_date date, p_end_date date, p_restaurant_ids uuid[])
 RETURNS TABLE(restaurant_id uuid, ads_spend_ht numeric, revenue_net_ttc numeric, revenue_net_ht numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH allowed AS (
  SELECT r.id FROM public.restaurants r
  WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
), ids AS (
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) AS a FROM allowed
), ads AS (
  SELECT pa.restaurant_id, ABS(COALESCE((SUM(pa.amount) / 1.2 /*TTC->HT*/),0)) AS a
  FROM public.ads_advertising_lines pa
  WHERE pa.category='advertising' AND pa.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
    AND pa.payout_date BETWEEN p_start_date AND p_end_date + 1
    AND public.ads_reporting_date(pa.payout_date) BETWEEN p_start_date AND p_end_date
  GROUP BY pa.restaurant_id
), rev AS (
  -- Same source and 4h business-day cutoff as get_ads_quarterly_summary
  SELECT s.restaurant_id,
    COALESCE(SUM(s.sales_incl_vat - s.item_promo_incl_vat_abs),0) AS ttc,
    COALESCE(SUM(s.rev_net_ht),0) AS ht
  FROM public.orders_daily_summary s
  WHERE s.restaurant_id = ANY((SELECT a FROM ids)::uuid[]) AND s.day BETWEEN p_start_date AND p_end_date
  GROUP BY s.restaurant_id
)
SELECT al.id, COALESCE(ads.a,0), COALESCE(rev.ttc,0), COALESCE(rev.ht,0)
FROM allowed al LEFT JOIN ads ON ads.restaurant_id=al.id LEFT JOIN rev ON rev.restaurant_id=al.id
WHERE COALESCE(ads.a,0)>0 OR COALESCE(rev.ttc,0)>0;
$function$;
