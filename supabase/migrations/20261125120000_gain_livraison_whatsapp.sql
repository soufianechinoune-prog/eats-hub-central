-- Commande WhatsApp (Châtaigne) : « Ce que la livraison rapporte au restaurant ».
-- Remplace l'ancien écran Rentabilité (simulation à curseurs) par des chiffres mesurés.
--
-- Gain par commande livrée = markup + frais de livraison payés par le client − coût de la course Uber Direct.
--
-- Constats du 25/11/2026 qui fixent les sources :
-- 1. Frais de livraison client : la colonne chataigne_orders.delivery_fee_amount est VIDE depuis fin août 2026
--    (0 commande sur 2 708 en octobre) → l'ancien écran affichait 0 €. La valeur est dans le détail de la
--    commande (raw_payload.charges, type « delivery »), présent sur 100 % des commandes.
-- 2. Markup = prix de l'article en livraison − prix du MÊME article en emporté. Le prix emporté de référence est
--    celui réellement constaté sur les commandes WhatsApp emportées :
--      a) du même restaurant (prix le plus fréquent sur la période, sinon ± 45 jours) ;
--      b) sinon des restaurants de la même grille de prix (restaurant_price_version) ; une enseigne sans
--         grilles (Tasty Crousty : 98,9 % des prix emporté identiques d'un restaurant à l'autre) forme une
--         seule grille ;
--      c) sinon la grille « sur place » de Mijotek (chataigne_item_instore_ref) ;
--    sinon l'article compte pour 0 € de markup et il est compté dans « sans prix emporté connu ».
--    La grille « sur place » seule ne suffit pas : elle diffère du prix emporté réel pour 11 % des articles.
--    Tout le panier est compté, suppléments et choix payants compris : total commande − frais = somme
--    (quantité × prix) de toutes les lignes (vérifié sur 764 commandes sur 768). Le prix d'un choix dépend
--    du produit auquel il est rattaché : il est donc comparé au même choix du même produit en emporté.
-- 3. Coût Uber Direct : prix réel de chaque course (API Uber Direct en lecture seule, rapprochée de la commande
--    par son numéro court). Montants TTC (99,9 % des prix sont un montant HT rond × 1,2).
--    Uber Direct n'est connecté que pour Chicken Street : pour les autres enseignes, pas de « vrai tarif ».
-- 4. Offre Uber Direct : le restaurant paie au plus 3,60 € TTC par course jusqu'au 31/12/2026 (information
--    donnée par Soufiane, non lisible dans l'API). Paramétrée par enseigne dans uber_direct_offer_caps.
-- 5. Seules les commandes livrées SANS offre client (ni bienvenue, ni parrainage, ni promo) sont comptées :
--    avec une offre, une partie du prix n'est pas payée par le client et le calcul n'est plus le même.

CREATE TABLE IF NOT EXISTS public.uber_direct_offer_caps (
  chain_id uuid NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  cap_cents integer NOT NULL CHECK (cap_cents >= 0),
  note text,
  PRIMARY KEY (chain_id, valid_from)
);
ALTER TABLE public.uber_direct_offer_caps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uber_direct_offer_caps FROM anon, authenticated;
GRANT ALL ON public.uber_direct_offer_caps TO service_role;

INSERT INTO public.uber_direct_offer_caps (chain_id, valid_from, valid_to, cap_cents, note) VALUES
  ('110e05b8-5136-45cc-a385-265360104844', '2026-01-01', '2026-12-31', 360, 'Offre Uber Direct : 3,60 € TTC max par course (Soufiane, 18/11/2026)'),
  ('ce67f809-d017-41c5-8bd0-a98086cd3881', '2026-01-01', '2026-12-31', 360, 'Offre Uber Direct : 3,60 € TTC max par course (Soufiane, 18/11/2026)')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_chataigne_delivery_gain(p_start date, p_end date, p_restaurant_ids uuid[])
 RETURNS TABLE(
   restaurant_id uuid, restaurant_name text,
   orders bigint,                 -- commandes livrées sans offre client
   orders_with_offer bigint,      -- commandes livrées avec une offre client (non comptées)
   markup numeric, delivery_fees numeric,
   cap_orders bigint, cap_cost numeric, gain_cap numeric, loss_orders_cap bigint,     -- avec l'offre Uber Direct
   real_orders bigint, real_cost numeric, gain_real numeric, real_markup numeric, real_delivery_fees numeric, -- au vrai tarif
   item_qty numeric, qty_ref_resto numeric, qty_ref_version numeric, qty_ref_grid numeric, qty_no_ref numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a, COALESCE(array_agg(DISTINCT r.chain_id), ARRAY[]::uuid[]) AS chains
    FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  ),
  bounds AS (
    SELECT (p_start::timestamp AT TIME ZONE 'Europe/Paris') s, ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris') e
  ),
  del AS (
    SELECT o.id, o.chataigne_order_id, o.restaurant_id AS rid, o.chain_id,
      (o.order_datetime AT TIME ZONE 'Europe/Paris')::date AS d,
      (COALESCE(o.discount_total_amount, 0) = 0
        AND (o.discounts IS NULL OR jsonb_typeof(o.discounts) <> 'array' OR jsonb_array_length(o.discounts) = 0)) AS no_offer
    FROM public.chataigne_orders o, bounds b
    WHERE o.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
      AND o.service_type = 'delivery' AND o.status = 'completed'
      AND o.order_datetime >= b.s AND o.order_datetime < b.e
  ),
  ord AS (
    SELECT d.id, d.chataigne_order_id, d.rid, d.chain_id, d.d,
      COALESCE((
        SELECT SUM((c.value -> 'amount' ->> 'amount')::numeric)
        FROM public.chataigne_orders o2,
          jsonb_array_elements(CASE WHEN jsonb_typeof(o2.raw_payload -> 'charges') = 'array' THEN o2.raw_payload -> 'charges' ELSE '[]'::jsonb END) c
        WHERE o2.id = d.id AND c.value ->> 'type' = 'delivery'
      ), (SELECT o3.delivery_fee_amount FROM public.chataigne_orders o3 WHERE o3.id = d.id), 0) AS fee
    FROM del d WHERE d.no_offer
  ),
  -- Prix emporté constatés (toute l'enseigne, pour pouvoir compléter par la grille de prix)
  tk AS (
    SELECT o.restaurant_id AS rid,
      CASE WHEN i.depth > 0 THEN COALESCE(lower(btrim(par.item_name)), '') || ' > ' ELSE '' END || lower(btrim(i.item_name)) AS nm,
      i.unit_price_amount AS p,
      COUNT(*) FILTER (WHERE o.order_datetime >= b.s AND o.order_datetime < b.e) AS n_in, COUNT(*) AS n
    FROM public.chataigne_orders o
    JOIN public.chataigne_order_items i ON i.chataigne_order_id = o.chataigne_order_id
    LEFT JOIN LATERAL (SELECT x.item_name FROM public.chataigne_order_items x
                       WHERE i.depth > 0 AND x.chataigne_order_id = i.chataigne_order_id AND x.item_id = i.parent_item_id LIMIT 1) par ON true,
      bounds b
    WHERE o.chain_id = ANY((SELECT chains FROM ids)::uuid[])
      AND o.service_type = 'collection' AND o.status = 'completed'
      AND o.order_datetime >= b.s - interval '45 days' AND o.order_datetime < b.e + interval '45 days'
      AND i.unit_price_amount > 0
    GROUP BY 1, 2, 3
  ),
  tk_resto AS (
    SELECT DISTINCT ON (rid, nm) rid, nm, p FROM tk ORDER BY rid, nm, n_in DESC, n DESC, p
  ),
  tk_version AS (
    SELECT DISTINCT ON (version, nm) version, nm, p
    FROM (SELECT r.chain_id::text || ':' || COALESCE(v.version, '*') AS version, t.nm, t.p, SUM(t.n_in) n_in, SUM(t.n) n
          FROM tk t JOIN public.restaurants r ON r.id = t.rid
          LEFT JOIN public.restaurant_price_version v ON v.restaurant_id = t.rid GROUP BY 1, 2, 3) x
    ORDER BY version, nm, n_in DESC, n DESC, p
  ),
  grid AS (
    SELECT f.restaurant_id AS rid, lower(btrim(f.item_name)) AS nm, MAX(f.instore_price) AS p
    FROM public.chataigne_item_instore_ref f
    WHERE f.restaurant_id = ANY((SELECT a FROM ids)::uuid[]) GROUP BY 1, 2
  ),
  it AS (
    SELECT k.id, k.q, k.up, tr.p AS p_resto, tv.p AS p_version, CASE WHEN k.depth = 0 THEN g.p END AS p_grid
    FROM (
      SELECT o.id, o.rid, o.chain_id, i.depth, i.quantity::numeric AS q, i.unit_price_amount AS up,
        CASE WHEN i.depth > 0 THEN COALESCE(lower(btrim(par.item_name)), '') || ' > ' ELSE '' END || lower(btrim(i.item_name)) AS nm
      FROM ord o
      JOIN public.chataigne_order_items i ON i.chataigne_order_id = o.chataigne_order_id
      LEFT JOIN LATERAL (SELECT x.item_name FROM public.chataigne_order_items x
                         WHERE i.depth > 0 AND x.chataigne_order_id = i.chataigne_order_id AND x.item_id = i.parent_item_id LIMIT 1) par ON true
      WHERE i.unit_price_amount > 0
    ) k
    LEFT JOIN public.restaurant_price_version v ON v.restaurant_id = k.rid
    LEFT JOIN tk_resto tr ON tr.rid = k.rid AND tr.nm = k.nm
    LEFT JOIN tk_version tv ON tv.version = k.chain_id::text || ':' || COALESCE(v.version, '*') AND tv.nm = k.nm
    LEFT JOIN grid g ON g.rid = k.rid AND g.nm = k.nm
  ),
  mk AS (
    SELECT id,
      SUM(q * (up - COALESCE(p_resto, p_version, p_grid, up))) AS markup,
      SUM(q) AS qty,
      SUM(q) FILTER (WHERE p_resto IS NOT NULL) AS q_resto,
      SUM(q) FILTER (WHERE p_resto IS NULL AND p_version IS NOT NULL) AS q_version,
      SUM(q) FILTER (WHERE p_resto IS NULL AND p_version IS NULL AND p_grid IS NOT NULL) AS q_grid,
      SUM(q) FILTER (WHERE p_resto IS NULL AND p_version IS NULL AND p_grid IS NULL) AS q_none
    FROM it GROUP BY id
  ),
  ud AS (
    SELECT m.order_id, SUM(m.fee_cents) / 100.0 AS fee
    FROM public.uber_direct_cost_mv m
    WHERE m.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
      AND m.paris_date BETWEEN p_start - 1 AND p_end + 1
      AND m.match_status = 'apparie' AND m.order_id IS NOT NULL AND m.fee_cents IS NOT NULL
    GROUP BY m.order_id
  ),
  per AS (
    SELECT o.rid, COALESCE(mk.markup, 0) AS markup, o.fee,
      COALESCE(mk.qty, 0) qty, COALESCE(mk.q_resto, 0) q_resto, COALESCE(mk.q_version, 0) q_version,
      COALESCE(mk.q_grid, 0) q_grid, COALESCE(mk.q_none, 0) q_none,
      ud.fee AS real_cost,
      -- Avec l'offre : au plus le plafond. Sans prix réel connu, on retient le plafond. Hors offre : prix réel.
      CASE WHEN cap.cap_cents IS NOT NULL THEN LEAST(COALESCE(ud.fee, cap.cap_cents / 100.0), cap.cap_cents / 100.0)
           ELSE ud.fee END AS cap_cost
    FROM ord o
    LEFT JOIN mk ON mk.id = o.id
    LEFT JOIN ud ON ud.order_id = o.id
    LEFT JOIN public.uber_direct_offer_caps cap ON cap.chain_id = o.chain_id AND o.d BETWEEN cap.valid_from AND cap.valid_to
  ),
  agg AS (
    SELECT rid, COUNT(*) AS orders, SUM(markup) AS markup, SUM(fee) AS fees,
      COUNT(cap_cost) AS cap_orders, SUM(cap_cost) AS cap_cost,
      SUM(markup + fee - cap_cost) AS gain_cap,
      COUNT(*) FILTER (WHERE markup + fee - cap_cost < 0) AS loss_cap,
      COUNT(real_cost) AS real_orders, SUM(real_cost) AS real_cost,
      SUM(markup + fee - real_cost) AS gain_real,
      SUM(markup) FILTER (WHERE real_cost IS NOT NULL) AS real_markup,
      SUM(fee) FILTER (WHERE real_cost IS NOT NULL) AS real_fees,
      SUM(qty) qty, SUM(q_resto) q_resto, SUM(q_version) q_version, SUM(q_grid) q_grid, SUM(q_none) q_none
    FROM per GROUP BY rid
  ),
  offers AS (
    SELECT rid, COUNT(*) FILTER (WHERE NOT no_offer) AS n FROM del GROUP BY rid
  )
  SELECT r.id, r.name::text,
    COALESCE(a.orders, 0)::bigint, COALESCE(f.n, 0)::bigint,
    ROUND(COALESCE(a.markup, 0), 2), ROUND(COALESCE(a.fees, 0), 2),
    COALESCE(a.cap_orders, 0)::bigint, ROUND(a.cap_cost, 2), ROUND(a.gain_cap, 2), COALESCE(a.loss_cap, 0)::bigint,
    COALESCE(a.real_orders, 0)::bigint, ROUND(a.real_cost, 2), ROUND(a.gain_real, 2), ROUND(a.real_markup, 2), ROUND(a.real_fees, 2),
    COALESCE(a.qty, 0), COALESCE(a.q_resto, 0), COALESCE(a.q_version, 0), COALESCE(a.q_grid, 0), COALESCE(a.q_none, 0)
  FROM offers f
  JOIN public.restaurants r ON r.id = f.rid
  LEFT JOIN agg a ON a.rid = f.rid
  ORDER BY r.name;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[]) TO authenticated, service_role;
