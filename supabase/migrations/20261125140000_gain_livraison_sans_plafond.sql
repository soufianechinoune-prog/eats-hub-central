-- Gain livraison WhatsApp : plus aucun prix saisi à la main (décision Soufiane, 25/11/2026).
--
-- Le coût de la course est UNIQUEMENT celui facturé par Uber Direct, lu dans la donnée
-- (uber_direct_deliveries.fee_cents) : 3,60 € tant que l'offre Uber s'appliquait, le prix réel ensuite.
-- Le plafond paramétré à 3,60 € (uber_direct_offer_caps) est supprimé : il faisait afficher un
-- « Uber Direct facturé 3,60 € » faux sur octobre et novembre 2026.
-- Conséquence : une commande sans course Uber Direct retrouvée n'a pas de gain calculé
-- (cap_cost = real_cost, gain_cap = gain_real). Tasty Crousty : Uber Direct non relié → pas de gain.

DO $do$
DECLARE d text; d2 text;
BEGIN
  SELECT pg_get_functiondef('public.chataigne_delivery_gain_core(date,date,uuid[])'::regprocedure) INTO d;
  d2 := replace(d, 'CASE WHEN cap.cap_cents IS NOT NULL THEN LEAST(COALESCE(ud.fee, cap.cap_cents / 100.0), cap.cap_cents / 100.0) ELSE ud.fee END', 'ud.fee');
  IF d2 = d THEN RAISE EXCEPTION 'patch 1 non appliqué'; END IF; d := d2;
  d2 := replace(d, E'\n  LEFT JOIN public.uber_direct_offer_caps cap ON cap.chain_id = d.chain_id AND d.d BETWEEN cap.valid_from AND cap.valid_to;', ';');
  IF d2 = d THEN RAISE EXCEPTION 'patch 2 non appliqué'; END IF;
  EXECUTE d2;
END $do$;

DROP TABLE IF EXISTS public.uber_direct_offer_caps;
