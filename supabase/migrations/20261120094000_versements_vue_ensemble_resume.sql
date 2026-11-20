-- Vue d'ensemble : rentabilité Uber (versements / ventes) depuis le résumé journalier.
--
-- Constat du 20/11/2026, Chicken Street, année 2026 :
-- - l'ancienne version relisait les commandes par date de versement : 45 s mesurées, au-delà de la limite de
--   30 s → la tuile « Rentabilité » restait vide (« -- ») ;
-- - elle renvoyait une ligne par restaurant et par date de versement (~4 700 lignes sur un an) alors que l'API
--   n'en rend que 1 000 : même quand elle aboutissait, le total était coupé.
--
-- Nouvelle version (0,7 s) : une ligne par restaurant.
-- - ventes, versements, titres-restaurant, nombre de commandes : orders_daily_summary, par journée de service
--   (même base que Revenus & Ventes) ;
-- - ajustements de versement (payout_adjustments) : inchangés, par date de versement dans la période.
-- Seul appelant : src/hooks/useOverviewData.ts, qui additionne déjà tout par restaurant.
-- payout_date vaut la fin de période (colonne conservée pour ne pas changer le type de retour).

CREATE OR REPLACE FUNCTION public.get_payouts_summary_range(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, payout_date date, sales_incl_vat numeric, net_payout numeric, order_count integer, meal_voucher_amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH allowed AS (
    SELECT r.id FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
  ),
  ord AS (
    SELECT s.restaurant_id rid,
      COALESCE(SUM(s.sales_incl_vat), 0) s, COALESCE(SUM(s.net_payout), 0) n,
      COALESCE(SUM(s.order_count), 0)::integer c, COALESCE(SUM(s.meal_voucher), 0) mv
    FROM public.orders_daily_summary s
    WHERE s.restaurant_id IN (SELECT id FROM allowed)
      AND s.day BETWEEN p_start_date AND p_end_date
    GROUP BY 1
  ),
  adj AS (
    SELECT a.restaurant_id rid, COALESCE(SUM(a.amount), 0) amt
    FROM public.payout_adjustments a
    WHERE a.restaurant_id IN (SELECT id FROM allowed)
      AND a.payout_date >= p_start_date AND a.payout_date <= p_end_date
    GROUP BY 1
  )
  SELECT COALESCE(o.rid, a.rid), p_end_date,
    COALESCE(o.s, 0), COALESCE(o.n, 0) + COALESCE(a.amt, 0), COALESCE(o.c, 0), COALESCE(o.mv, 0)
  FROM ord o FULL OUTER JOIN adj a ON o.rid = a.rid
  ORDER BY 1;
$function$;
