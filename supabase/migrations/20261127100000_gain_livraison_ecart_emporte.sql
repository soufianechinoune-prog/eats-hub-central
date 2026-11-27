-- Gain livraison WhatsApp : « Écart vs emporté », la vraie comparaison livraison contre emporté
-- (demande Soufiane, 27/11/2026).
--
-- L'ancien « résultat complet » retirait TOUT le frais Châtaigne et TOUT le frais Stripe du frais de service
-- de la commande livrée, comme si une commande à emporter n'en payait pas. C'est faux : l'emporté paie aussi
-- un frais de service (Chicken Street novembre 2026 : 1,00 € en emporté, 1,99 € en livraison, sans exception),
-- le même frais Châtaigne, et un frais Stripe sur un total plus petit.
--
-- Écart vs emporté = markup + frais de livraison client − course Uber Direct
--                    + (frais de service livraison − frais de service emporté)
--                    − Stripe en plus (pourcentage Stripe × ce que le client paie en plus)
-- Le frais Châtaigne est identique dans les deux cas : il sort du calcul.
-- Le frais de service emporté est LU dans la donnée (valeur la plus fréquente des commandes à emporter de
-- l'enseigne, jour le plus proche). Seul le pourcentage Stripe reste une estimation (chataigne_channel_fees).
--
-- Contrôle Nice, commande K7V2 du 08/11/2026 : livrée 21,94 € pour le restaurant, emporté 23,72 € → −1,78 €.
-- Chicken Street 1 → 26/11/2026 : toutes commandes (offre neutralisée) gain livraison −692,96 €,
-- écart vs emporté +555,23 € (1 462 commandes) ; sans offre −370,90 € et −20,30 € (406 commandes).
-- Les anciennes colonnes (chataigne_fee, stripe_fee, service_balance, full_result…) restent renvoyées.

DO $do$
DECLARE d text; n text; v_n int; v_g numeric; v_tk numeric;
BEGIN
  -- 1. cœur : frais de service d'une commande à emporter (lu dans la donnée, jour le plus proche)
  d := pg_get_functiondef('public.chataigne_delivery_gain_core(date,date,uuid[])'::regprocedure);
  n := replace(d, 'offer_kind text, offer_label text, discount numeric)', 'offer_kind text, offer_label text, discount numeric, takeaway_service_fee numeric)');
  IF n = d THEN RAISE EXCEPTION 'c1'; END IF; d := n;
  -- MATERIALIZED obligatoire : sinon le calcul est refait pour chaque commande (57 s au lieu de 3 s sur un mois)
  n := regexp_replace(d, '\),\s+ord AS \(', E'),\n  tksvc AS MATERIALIZED (\n    SELECT o.chain_id, (o.order_datetime AT TIME ZONE ''Europe/Paris'')::date AS d, mode() WITHIN GROUP (ORDER BY o.service_charge_amount) AS s\n    FROM public.chataigne_orders o, bounds b\n    WHERE o.chain_id = ANY((SELECT chains FROM ids)::uuid[])\n      AND o.service_type = ''collection'' AND o.status = ''completed'' AND o.service_charge_amount IS NOT NULL\n      AND o.order_datetime >= b.s - interval ''45 days'' AND o.order_datetime < b.e + interval ''45 days''\n    GROUP BY 1, 2\n  ),\n  ord AS (');
  IF n = d THEN RAISE EXCEPTION 'c2'; END IF; d := n;
  n := replace(d, 'd.kind, d.label, d.disc', 'd.kind, d.label, d.disc, (SELECT t.s FROM tksvc t WHERE t.chain_id = d.chain_id ORDER BY abs(t.d - d.d), t.d LIMIT 1)');
  IF n = d THEN RAISE EXCEPTION 'c3'; END IF;
  DROP FUNCTION public.chataigne_delivery_gain_core(date, date, uuid[]);
  EXECUTE n;
  REVOKE ALL ON FUNCTION public.chataigne_delivery_gain_core(date, date, uuid[]) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.chataigne_delivery_gain_core(date, date, uuid[]) TO service_role;

  -- 2. détail par commande
  d := pg_get_functiondef('public.get_chataigne_delivery_gain_orders(date,date,uuid,text)'::regprocedure);
  n := replace(d, 'paid_amount numeric)', 'paid_amount numeric, service_extra numeric, stripe_extra numeric, takeaway_gap numeric)');
  IF n = d THEN RAISE EXCEPTION 'o1'; END IF; d := n;
  n := replace(d, 'f.chataigne_fee_eur AS chat,', 'f.chataigne_fee_eur AS chat, ROUND(f.stripe_pct * (c.markup + c.delivery_fee + c.svc - c.takeaway_service_fee), 2) AS stripex,');
  IF n = d THEN RAISE EXCEPTION 'o2'; END IF; d := n;
  n := replace(d, 'ROUND(k.total_amount - k.discount, 2)', 'ROUND(k.total_amount - k.discount, 2), ROUND(k.svc - k.takeaway_service_fee, 2), k.stripex, ROUND(k.markup + k.delivery_fee - k.real_cost + k.svc - k.takeaway_service_fee - k.stripex, 2)');
  IF n = d THEN RAISE EXCEPTION 'o3'; END IF;
  DROP FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid, text);
  EXECUTE n;
  REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid, text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid, text) TO authenticated, service_role;

  -- 3. résumé par restaurant
  d := pg_get_functiondef('public.get_chataigne_delivery_gain(date,date,uuid[],text)'::regprocedure);
  n := replace(d, 'avg_distance_km numeric)', 'avg_distance_km numeric, real_service_extra numeric, real_stripe_extra numeric, takeaway_gap numeric)');
  IF n = d THEN RAISE EXCEPTION 'r1'; END IF; d := n;
  n := replace(d, 'FROM c GROUP BY c.restaurant_id', 'FROM (SELECT c.*, CASE WHEN c.inc AND c.real_cost IS NOT NULL THEN c.svc - c.takeaway_service_fee END AS svcx, CASE WHEN c.inc AND c.real_cost IS NOT NULL THEN ROUND(f2.stripe_pct * (c.markup + c.delivery_fee + c.svc - c.takeaway_service_fee), 2) END AS stripex FROM c LEFT JOIN public.chataigne_channel_fees f2 ON f2.chain_id = c.chain_id) c GROUP BY c.restaurant_id');
  IF n = d THEN RAISE EXCEPTION 'r2'; END IF; d := n;
  n := replace(d, 'AVG(c.distance_km) FILTER (WHERE c.inc AND c.real_cost IS NOT NULL) AS km', 'AVG(c.distance_km) FILTER (WHERE c.inc AND c.real_cost IS NOT NULL) AS km, SUM(c.svcx) AS svcx, SUM(c.stripex) AS stripex, SUM(c.markup + c.delivery_fee - c.real_cost + c.svcx - c.stripex) AS gap');
  IF n = d THEN RAISE EXCEPTION 'r3'; END IF; d := n;
  n := replace(d, 'ROUND(a.km, 1)', 'ROUND(a.km, 1), ROUND(a.svcx, 2), ROUND(a.stripex, 2), ROUND(a.gap, 2)');
  IF n = d THEN RAISE EXCEPTION 'r4'; END IF;
  DROP FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[], text);
  EXECUTE n;
  REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[], text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[], text) TO authenticated, service_role;

  -- 4. vue par offre
  d := pg_get_functiondef('public.get_chataigne_delivery_gain_by_offer(date,date,uuid[])'::regprocedure);
  n := replace(d, 'discounts_all numeric)', 'discounts_all numeric, takeaway_gap numeric)');
  IF n = d THEN RAISE EXCEPTION 'b1'; END IF; d := n;
  n := replace(d, 'ROUND(SUM(c.discount), 2)', 'ROUND(SUM(c.discount), 2), ROUND(SUM(c.markup + c.delivery_fee - c.real_cost + c.svc - c.takeaway_service_fee - ROUND(f.stripe_pct * (c.markup + c.delivery_fee + c.svc - c.takeaway_service_fee), 2)), 2)');
  IF n = d THEN RAISE EXCEPTION 'b2'; END IF; d := n;
  n := replace(d, 'FROM c LEFT JOIN lab ON lab.offer_kind = c.offer_kind', 'FROM c LEFT JOIN lab ON lab.offer_kind = c.offer_kind LEFT JOIN public.chataigne_channel_fees f ON f.chain_id = c.chain_id');
  IF n = d THEN RAISE EXCEPTION 'b3'; END IF;
  DROP FUNCTION public.get_chataigne_delivery_gain_by_offer(date, date, uuid[]);
  EXECUTE n;
  REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain_by_offer(date, date, uuid[]) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain_by_offer(date, date, uuid[]) TO authenticated, service_role;

  -- contrôles : Reims 1 → 24/11 sans offre inchangé (21 commandes, gain −4,11 €) ; Nice K7V2 : frais de service emporté 1,00 €
  SELECT count(*), round(sum(c.markup + c.delivery_fee - c.real_cost), 2) INTO v_n, v_g
  FROM public.chataigne_delivery_gain_core('2026-11-01', '2026-11-24', ARRAY['169c998f-c8dc-4d37-8d7b-3096a94486e3']::uuid[]) c
  WHERE c.no_offer AND c.real_cost IS NOT NULL;
  IF v_n <> 21 OR v_g <> -4.11 THEN RAISE EXCEPTION 'regression Reims: % commandes, gain %', v_n, v_g; END IF;
  SELECT c.takeaway_service_fee INTO v_tk
  FROM public.chataigne_delivery_gain_core('2026-11-08', '2026-11-08', ARRAY['b7b52b9d-6f58-4489-9141-df1ae372e59e']::uuid[]) c WHERE c.short_id = 'K7V2';
  IF v_tk IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Nice K7V2: frais de service emporté %', v_tk; END IF;
END $do$;
