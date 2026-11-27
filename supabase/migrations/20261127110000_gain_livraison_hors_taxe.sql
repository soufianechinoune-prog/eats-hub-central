-- Gain livraison WhatsApp : même comparatif en hors taxe (demande Soufiane, 27/11/2026).
--
-- Le restaurant reverse la TVA encaissée sur ses ventes et récupère celle payée à ses fournisseurs.
-- En TTC, on compare des montants qui ne portent pas le même taux. p_tax = 'ht' convertit chaque ligne :
--   articles (donc markup, remise)              ÷ (1 + vat_items)            10 %
--   frais de livraison et de service du client  ÷ (1 + vat_customer_fees)    20 % — À CONFIRMER par le comptable
--   course Uber Direct                          ÷ (1 + vat_uber_direct)      20 %
--   frais de paiement                           sans TVA, calculés sur le montant TTC payé par le client
--   frais Châtaigne                             autoliquidé, hors de l'écart vs emporté
-- Les taux sont réglés par enseigne dans chataigne_vat_rates (aucun taux en dur dans le calcul).
--
-- Pièces (27/11/2026) :
--   Uber Direct : facture Uber Eats France SAS, Belfort octobre 2026, 428,50 € HT + 85,70 € TVA 20 % = 514,20 € TTC ;
--     Mijotek lit le montant TTC (course XZ61 : 7,08 € chez nous, 5,90 € HT sur la facture).
--   Châtaigne : société suisse, TVA autoliquidée ; 1 € HT sur les 129 premières commandes de la période,
--     0 € de 130 à 300, 1 € au-delà. Frais de paiement sans TVA sur toutes les commandes,
--     environ 1,6 % + 0,23 € par commande (recoupé sur Argenteuil et Belfort).
--
-- chataigne_delivery_gain_base : une ligne par commande livrée, tous montants arrondis au centime dans le mode
-- demandé ; les trois fonctions publiques ne font plus qu'agréger (détail et résumé retombent au centime).
-- Contrôle Chicken Street 1 → 26/11/2026, toutes commandes offre neutralisée (1 462) :
--   TTC gain −692,96 €, écart vs emporté +542,02 € ; HT gain −221,90 €, écart vs emporté +779,16 €.
--   Sans offre (406) : TTC −370,90 € / −23,78 € ; HT −223,86 € / +58,30 €.
--   Nice K7V2 : TTC −2,65 € / −1,79 € ; HT −2,06 € / −1,36 €.

CREATE TABLE IF NOT EXISTS public.chataigne_vat_rates (
  chain_id uuid PRIMARY KEY REFERENCES public.chains(id) ON DELETE CASCADE,
  vat_items numeric NOT NULL CHECK (vat_items >= 0 AND vat_items < 1),
  vat_customer_fees numeric NOT NULL CHECK (vat_customer_fees >= 0 AND vat_customer_fees < 1),
  vat_uber_direct numeric NOT NULL CHECK (vat_uber_direct >= 0 AND vat_uber_direct < 1),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chataigne_vat_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chataigne_vat_rates FROM anon, authenticated;
GRANT ALL ON public.chataigne_vat_rates TO service_role;
INSERT INTO public.chataigne_vat_rates (chain_id, vat_items, vat_customer_fees, vat_uber_direct, note) VALUES
  ('110e05b8-5136-45cc-a385-265360104844', 0.10, 0.20, 0.20, 'Articles 10 % (restauration livrée ou à emporter). Frais de livraison et de service payés par le client : 20 % retenu par Soufiane le 27/11/2026, À CONFIRMER par le comptable (10 % si frais accessoires à la vente). Uber Direct 20 % : facture Uber Eats France SAS d''octobre 2026, montants lus en TTC.'),
  ('ce67f809-d017-41c5-8bd0-a98086cd3881', 0.10, 0.20, 0.20, 'Mêmes hypothèses que Chicken Street (27/11/2026), à confirmer par le comptable. Uber Direct non relié pour cette enseigne.')
ON CONFLICT (chain_id) DO NOTHING;
UPDATE public.chataigne_channel_fees SET stripe_pct = 0.016, stripe_fixed_eur = 0.23, updated_at = now(),
  note = 'Frais de paiement calés sur les factures Châtaigne d''Argenteuil et de Belfort (oct.-nov. 2026) : environ 1,6 % + 0,23 € par commande, sans TVA. Frais Châtaigne : 1 € HT autoliquidé sur les 129 premières commandes de la période, 0 € de 130 à 300, 1 € au-delà (identique en livraison et en emporté, donc hors de l''écart vs emporté).'
WHERE chain_id = '110e05b8-5136-45cc-a385-265360104844';

CREATE OR REPLACE FUNCTION public.chataigne_delivery_gain_base(p_start date, p_end date, p_restaurant_ids uuid[], p_tax text)
 RETURNS TABLE(order_id uuid, short_id text, restaurant_id uuid, chain_id uuid, order_datetime timestamptz, no_offer boolean,
   offer_kind text, offer_label text, total_amount numeric, paid_amount numeric, discount numeric,
   items_delivery numeric, items_takeaway numeric, markup numeric, delivery_fee numeric, service_fee numeric,
   real_cost numeric, distance_km numeric, gain numeric, service_extra numeric, stripe_extra numeric, takeaway_gap numeric,
   item_qty numeric, qty_ref_resto numeric, qty_ref_version numeric, qty_ref_grid numeric, qty_no_ref numeric,
   chataigne_fee numeric, stripe_fee numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH c AS (
    SELECT x.*, COALESCE((
        SELECT SUM((s.value -> 'amount' ->> 'amount')::numeric)
        FROM public.chataigne_orders o,
          jsonb_array_elements(CASE WHEN jsonb_typeof(o.raw_payload -> 'charges') = 'array' THEN o.raw_payload -> 'charges' ELSE '[]'::jsonb END) s
        WHERE o.id = x.order_id AND s.value ->> 'type' = 'service'), 0) AS svc_ttc
    FROM public.chataigne_delivery_gain_core(p_start, p_end, p_restaurant_ids) x
  ),
  k AS (
    SELECT c.*, f.chataigne_fee_eur AS chat, f.stripe_pct, f.stripe_fixed_eur,
      CASE WHEN p_tax = 'ht' THEN 1 + v.vat_items ELSE 1 END AS di,
      CASE WHEN p_tax = 'ht' THEN 1 + v.vat_customer_fees ELSE 1 END AS df,
      CASE WHEN p_tax = 'ht' THEN 1 + v.vat_uber_direct ELSE 1 END AS du
    FROM c
    LEFT JOIN public.chataigne_channel_fees f ON f.chain_id = c.chain_id
    LEFT JOIN public.chataigne_vat_rates v ON v.chain_id = c.chain_id
  ),
  r AS (
    SELECT k.*,
      ROUND(k.markup / k.di, 2) AS mk,
      ROUND((k.total_amount - k.delivery_fee - k.svc_ttc) / k.di, 2) AS art,
      ROUND(k.delivery_fee / k.df, 2) AS liv,
      ROUND(k.svc_ttc / k.df, 2) AS svc,
      ROUND(k.real_cost / k.du, 2) AS ud,
      ROUND(k.discount / k.di, 2) AS disc,
      ROUND((k.svc_ttc - k.takeaway_service_fee) / k.df, 2) AS svcx,
      -- les frais de paiement n'ont pas de TVA et portent sur le montant TTC payé par le client
      ROUND(k.stripe_pct * (k.markup + k.delivery_fee + k.svc_ttc - k.takeaway_service_fee), 2) AS stripex,
      ROUND(k.total_amount * k.stripe_pct + k.stripe_fixed_eur, 2) AS stripe
    FROM k
  )
  SELECT r.order_id, r.short_id, r.restaurant_id, r.chain_id, r.order_datetime, r.no_offer, r.offer_kind, r.offer_label,
    r.art + r.liv + r.svc, r.art + r.liv + r.svc - r.disc, r.disc,
    r.art, r.art - r.mk, r.mk, r.liv, r.svc,
    r.ud, r.distance_km, r.mk + r.liv - r.ud, r.svcx, r.stripex, r.mk + r.liv - r.ud + r.svcx - r.stripex,
    r.item_qty, r.qty_ref_resto, r.qty_ref_version, r.qty_ref_grid, r.qty_no_ref, r.chat, r.stripe
  FROM r;
$function$;
REVOKE ALL ON FUNCTION public.chataigne_delivery_gain_base(date, date, uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chataigne_delivery_gain_base(date, date, uuid[], text) TO service_role;

DROP FUNCTION IF EXISTS public.get_chataigne_delivery_gain(date, date, uuid[], text);
CREATE OR REPLACE FUNCTION public.get_chataigne_delivery_gain(p_start date, p_end date, p_restaurant_ids uuid[], p_scope text DEFAULT 'no_offer', p_tax text DEFAULT 'ttc')
 RETURNS TABLE(
   restaurant_id uuid, restaurant_name text,
   orders bigint, orders_with_offer bigint,
   markup numeric, delivery_fees numeric,
   cap_orders bigint, cap_cost numeric, gain_cap numeric, loss_orders_cap bigint,
   real_orders bigint, real_cost numeric, gain_real numeric, real_markup numeric, real_delivery_fees numeric,
   item_qty numeric, qty_ref_resto numeric, qty_ref_version numeric, qty_ref_grid numeric, qty_no_ref numeric,
   real_total numeric, real_service_fees numeric, chataigne_fees numeric, stripe_fees numeric, avg_distance_km numeric,
   real_service_extra numeric, real_stripe_extra numeric, takeaway_gap numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  ),
  c AS (
    SELECT x.*, CASE WHEN p_scope = 'all' THEN x.offer_kind <> 'article_offert' ELSE x.no_offer END AS inc,
      x.real_cost IS NOT NULL AS priced
    FROM public.chataigne_delivery_gain_base(p_start, p_end, (SELECT a FROM ids)::uuid[], p_tax) x
  ),
  agg AS (
    SELECT c.restaurant_id AS rid,
      COUNT(*) FILTER (WHERE c.inc) AS orders, COUNT(*) FILTER (WHERE NOT c.inc) AS with_offer,
      SUM(c.markup) FILTER (WHERE c.inc) AS markup, SUM(c.delivery_fee) FILTER (WHERE c.inc) AS fees,
      COUNT(*) FILTER (WHERE c.inc AND c.priced) AS real_orders,
      SUM(c.real_cost) FILTER (WHERE c.inc) AS real_cost, SUM(c.gain) FILTER (WHERE c.inc) AS gain,
      COUNT(*) FILTER (WHERE c.inc AND c.gain < 0) AS loss,
      SUM(c.markup) FILTER (WHERE c.inc AND c.priced) AS real_markup, SUM(c.delivery_fee) FILTER (WHERE c.inc AND c.priced) AS real_fees,
      SUM(c.item_qty) FILTER (WHERE c.inc) qty, SUM(c.qty_ref_resto) FILTER (WHERE c.inc) q_resto,
      SUM(c.qty_ref_version) FILTER (WHERE c.inc) q_version, SUM(c.qty_ref_grid) FILTER (WHERE c.inc) q_grid,
      SUM(c.qty_no_ref) FILTER (WHERE c.inc) q_none,
      SUM(c.total_amount) FILTER (WHERE c.inc AND c.priced) AS real_total,
      SUM(c.service_fee) FILTER (WHERE c.inc AND c.priced) AS real_svc,
      SUM(c.chataigne_fee) FILTER (WHERE c.inc AND c.priced) AS chat,
      SUM(c.stripe_fee) FILTER (WHERE c.inc AND c.priced) AS stripe,
      AVG(c.distance_km) FILTER (WHERE c.inc AND c.priced) AS km,
      SUM(c.service_extra) FILTER (WHERE c.inc AND c.priced) AS svcx,
      SUM(c.stripe_extra) FILTER (WHERE c.inc AND c.priced) AS stripex,
      SUM(c.takeaway_gap) FILTER (WHERE c.inc AND c.priced) AS gap
    FROM c GROUP BY c.restaurant_id
  )
  SELECT r.id, r.name::text,
    a.orders::bigint, a.with_offer::bigint,
    ROUND(COALESCE(a.markup, 0), 2), ROUND(COALESCE(a.fees, 0), 2),
    a.real_orders::bigint, ROUND(a.real_cost, 2), ROUND(a.gain, 2), a.loss::bigint,
    a.real_orders::bigint, ROUND(a.real_cost, 2), ROUND(a.gain, 2), ROUND(a.real_markup, 2), ROUND(a.real_fees, 2),
    COALESCE(a.qty, 0), COALESCE(a.q_resto, 0), COALESCE(a.q_version, 0), COALESCE(a.q_grid, 0), COALESCE(a.q_none, 0),
    ROUND(a.real_total, 2), ROUND(a.real_svc, 2), ROUND(a.chat, 2), ROUND(a.stripe, 2), ROUND(a.km, 1),
    ROUND(a.svcx, 2), ROUND(a.stripex, 2), ROUND(a.gap, 2)
  FROM agg a JOIN public.restaurants r ON r.id = a.rid
  ORDER BY r.name;
$function$;
REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[], text, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_chataigne_delivery_gain_orders(date, date, uuid, text);
CREATE OR REPLACE FUNCTION public.get_chataigne_delivery_gain_orders(p_start date, p_end date, p_restaurant_id uuid, p_scope text DEFAULT 'no_offer', p_tax text DEFAULT 'ttc')
 RETURNS TABLE(order_id uuid, short_id text, order_datetime timestamptz, total_amount numeric,
   markup numeric, delivery_fee numeric, real_cost numeric, cap_cost numeric, distance_km numeric,
   gain_cap numeric, gain_real numeric, items_without_ref numeric,
   service_fee numeric, items_delivery numeric, items_takeaway numeric,
   chataigne_fee numeric, stripe_fee numeric, service_balance numeric, full_result numeric,
   offer_kind text, offer_label text, discount numeric, paid_amount numeric,
   service_extra numeric, stripe_extra numeric, takeaway_gap numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = p_restaurant_id AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  )
  SELECT k.order_id, k.short_id, k.order_datetime, k.total_amount,
    k.markup, k.delivery_fee, k.real_cost, k.real_cost, ROUND(k.distance_km, 1),
    k.gain, k.gain, k.qty_no_ref,
    k.service_fee, k.items_delivery, k.items_takeaway,
    k.chataigne_fee, k.stripe_fee,
    ROUND(k.service_fee - k.chataigne_fee - k.stripe_fee, 2),
    ROUND(k.gain + k.service_fee - k.chataigne_fee - k.stripe_fee, 2),
    k.offer_kind, k.offer_label, k.discount, k.paid_amount,
    k.service_extra, k.stripe_extra, k.takeaway_gap
  FROM public.chataigne_delivery_gain_base(p_start, p_end, (SELECT a FROM ids)::uuid[], p_tax) k
  WHERE CASE WHEN p_scope = 'all' THEN k.offer_kind <> 'article_offert' ELSE k.no_offer END
  ORDER BY k.order_datetime DESC;
$function$;
REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid, text, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_chataigne_delivery_gain_by_offer(date, date, uuid[]);
CREATE OR REPLACE FUNCTION public.get_chataigne_delivery_gain_by_offer(p_start date, p_end date, p_restaurant_ids uuid[], p_tax text DEFAULT 'ttc')
 RETURNS TABLE(offer_kind text, offer_labels text, orders bigint, real_orders bigint,
   items_delivery numeric, markup numeric, delivery_fees numeric, real_cost numeric, gain_real numeric,
   loss_orders bigint, discounts numeric, discounts_all numeric, takeaway_gap numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  ),
  c AS (SELECT x.*, x.real_cost IS NOT NULL AS priced FROM public.chataigne_delivery_gain_base(p_start, p_end, (SELECT a FROM ids)::uuid[], p_tax) x),
  lab AS (
    SELECT t.offer_kind, string_agg(t.offer_label, ' · ' ORDER BY t.n DESC) AS labels
    FROM (SELECT c.offer_kind, c.offer_label, COUNT(*) n, ROW_NUMBER() OVER (PARTITION BY c.offer_kind ORDER BY COUNT(*) DESC) rk
          FROM c WHERE c.offer_label IS NOT NULL GROUP BY 1, 2) t
    WHERE t.rk <= 4 GROUP BY t.offer_kind
  )
  SELECT c.offer_kind, MAX(lab.labels),
    COUNT(*)::bigint, COUNT(*) FILTER (WHERE c.priced)::bigint,
    ROUND(SUM(c.items_delivery) FILTER (WHERE c.priced), 2),
    ROUND(SUM(c.markup) FILTER (WHERE c.priced), 2),
    ROUND(SUM(c.delivery_fee) FILTER (WHERE c.priced), 2),
    ROUND(SUM(c.real_cost), 2),
    ROUND(SUM(c.gain), 2),
    COUNT(*) FILTER (WHERE c.gain < 0)::bigint,
    ROUND(SUM(c.discount) FILTER (WHERE c.priced), 2),
    ROUND(SUM(c.discount), 2),
    ROUND(SUM(c.takeaway_gap), 2)
  FROM c LEFT JOIN lab ON lab.offer_kind = c.offer_kind
  GROUP BY c.offer_kind
  ORDER BY array_position(ARRAY['none', 'bienvenue', 'parrainage', 'promo', 'article_offert'], c.offer_kind);
$function$;
REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain_by_offer(date, date, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain_by_offer(date, date, uuid[], text) TO authenticated, service_role;

-- Réglages affichés dans les info-bulles de la page (taux de TVA et frais de paiement de l'enseigne).
CREATE OR REPLACE FUNCTION public.get_chataigne_delivery_gain_settings(p_chain_id uuid)
 RETURNS TABLE(vat_items numeric, vat_customer_fees numeric, vat_uber_direct numeric, vat_note text, stripe_pct numeric, stripe_fixed_eur numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT v.vat_items, v.vat_customer_fees, v.vat_uber_direct, v.note, f.stripe_pct, f.stripe_fixed_eur
  FROM public.chains ch
  LEFT JOIN public.chataigne_vat_rates v ON v.chain_id = ch.id
  LEFT JOIN public.chataigne_channel_fees f ON f.chain_id = ch.id
  WHERE ch.id = p_chain_id AND (public.is_super_admin() OR public.user_has_chain_access(ch.id));
$function$;
REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain_settings(uuid) TO authenticated, service_role;
