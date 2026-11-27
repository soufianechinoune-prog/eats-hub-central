-- Gain livraison WhatsApp : les commandes avec offre entrent dans le calcul, offre neutralisée
-- (décision Soufiane, 27/11/2026).
--
-- Pourquoi : la page sert à valider le modèle de livraison (markup + frais de livraison ≥ course Uber Direct).
-- Les commandes sans offre ne sont qu'une livraison sur quatre et leur panier est plus petit : jugé sur elles
-- seules, le modèle paraît deux fois plus déficitaire. L'offre (bienvenue −25 %, parrainage…) est un coût
-- d'acquisition, suivi à part.
--
-- « Offre neutralisée » = la commande est comptée comme si l'offre n'existait pas :
--   total hors offre = total payé + remise ; les articles sont pris à leur prix catalogue (c'est déjà ce que
--   porte chataigne_order_items). Vérifié sur 1 590 commandes Chicken Street du 1 au 26/11/2026 :
--   total payé = articles + frais de livraison + frais de service − remise, au centime ; la remise ne touche
--   jamais les frais de livraison.
--
-- Familles d'offre (d'après le nom de l'offre lu dans la commande) :
--   none · bienvenue · parrainage · promo (toute autre remise) · article_offert (« 1 acheté = 1 offert »,
--   « Article offert ») — cette dernière reste HORS du gain : l'article gratuit serait compté comme payé.
--
-- p_scope : 'no_offer' (défaut, comportement d'avant) ou 'all' (toutes les commandes sauf article_offert).
--
-- Contrôle Chicken Street 1 → 26/11/2026 (courses Uber Direct retrouvées) :
--   sans offre 406 commandes, gain −0,91 €/commande (−370,90 €) ; toutes 1 462 commandes hors article offert ;
--   bienvenue 938 (−0,39 €), parrainage 118 (+0,37 €), article offert 128 (−0,34 €, hors gain).

DROP FUNCTION IF EXISTS public.chataigne_delivery_gain_core(date, date, uuid[]);
CREATE FUNCTION public.chataigne_delivery_gain_core(p_start date, p_end date, p_restaurant_ids uuid[])
 RETURNS TABLE(order_id uuid, short_id text, restaurant_id uuid, chain_id uuid, order_datetime timestamptz, no_offer boolean,
   total_amount numeric, delivery_fee numeric, markup numeric,
   item_qty numeric, qty_ref_resto numeric, qty_ref_version numeric, qty_ref_grid numeric, qty_no_ref numeric,
   real_cost numeric, distance_km numeric, cap_cost numeric,
   offer_kind text, offer_label text, discount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a, COALESCE(array_agg(DISTINCT r.chain_id), ARRAY[]::uuid[]) AS chains
    FROM public.restaurants r WHERE r.id = ANY(p_restaurant_ids)
  ),
  bounds AS (
    SELECT (p_start::timestamp AT TIME ZONE 'Europe/Paris') s, ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris') e
  ),
  del0 AS (
    SELECT o.id, o.chataigne_order_id, o.restaurant_id AS rid, o.chain_id, o.short_id, o.order_datetime, o.total_amount,
      (o.order_datetime AT TIME ZONE 'Europe/Paris')::date AS d,
      (COALESCE(o.discount_total_amount, 0) = 0
        AND (o.discounts IS NULL OR jsonb_typeof(o.discounts) <> 'array' OR jsonb_array_length(o.discounts) = 0)) AS no_offer,
      COALESCE(o.discount_total_amount, 0) AS disc,
      (SELECT string_agg(btrim(x.value ->> 'name'), ' + ')
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN o.discounts ELSE '[]'::jsonb END) x
       WHERE btrim(COALESCE(x.value ->> 'name', '')) <> '') AS label
    FROM public.chataigne_orders o, bounds b
    WHERE o.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
      AND o.service_type = 'delivery' AND o.status = 'completed'
      AND o.order_datetime >= b.s AND o.order_datetime < b.e
  ),
  del AS (
    SELECT d0.*,
      CASE WHEN d0.no_offer THEN 'none'
           WHEN d0.label ~* 'achet|article offert' THEN 'article_offert'
           WHEN d0.label ~* 'bienvenue' THEN 'bienvenue'
           WHEN d0.label ~* 'parrain|referral' THEN 'parrainage'
           ELSE 'promo' END AS kind
    FROM del0 d0
  ),
  ord AS (
    SELECT d.id, d.chataigne_order_id, d.rid, d.chain_id, d.d,
      COALESCE((
        SELECT SUM((c.value -> 'amount' ->> 'amount')::numeric)
        FROM public.chataigne_orders o2,
          jsonb_array_elements(CASE WHEN jsonb_typeof(o2.raw_payload -> 'charges') = 'array' THEN o2.raw_payload -> 'charges' ELSE '[]'::jsonb END) c
        WHERE o2.id = d.id AND c.value ->> 'type' = 'delivery'
      ), (SELECT o3.delivery_fee_amount FROM public.chataigne_orders o3 WHERE o3.id = d.id), 0) AS fee
    FROM del d
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
    SELECT m.order_id, SUM(m.fee_cents) / 100.0 AS fee, MAX(dd.distance_km) AS km
    FROM public.uber_direct_cost_mv m
    LEFT JOIN public.uber_direct_deliveries dd ON dd.id = m.delivery_id
    WHERE m.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
      AND m.paris_date BETWEEN p_start - 1 AND p_end + 1
      AND m.match_status = 'apparie' AND m.order_id IS NOT NULL AND m.fee_cents IS NOT NULL
    GROUP BY m.order_id
  )
  -- total_amount = total hors offre (total payé + remise) ; identique au total payé pour une commande sans offre.
  SELECT d.id, d.short_id, d.rid, d.chain_id, d.order_datetime, d.no_offer, d.total_amount + d.disc,
    o.fee, COALESCE(mk.markup, 0),
    COALESCE(mk.qty, 0), COALESCE(mk.q_resto, 0), COALESCE(mk.q_version, 0), COALESCE(mk.q_grid, 0), COALESCE(mk.q_none, 0),
    ud.fee, ud.km, ud.fee,
    d.kind, d.label, d.disc
  FROM del d
  LEFT JOIN ord o ON o.id = d.id
  LEFT JOIN mk ON mk.id = d.id
  LEFT JOIN ud ON ud.order_id = d.id;
$function$;
REVOKE ALL ON FUNCTION public.chataigne_delivery_gain_core(date, date, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chataigne_delivery_gain_core(date, date, uuid[]) TO service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Résumé par restaurant. orders_with_offer = commandes livrées hors du périmètre choisi.
DROP FUNCTION IF EXISTS public.get_chataigne_delivery_gain(date, date, uuid[]);
DROP FUNCTION IF EXISTS public.get_chataigne_delivery_gain(date, date, uuid[], text);
CREATE FUNCTION public.get_chataigne_delivery_gain(p_start date, p_end date, p_restaurant_ids uuid[], p_scope text DEFAULT 'no_offer')
 RETURNS TABLE(
   restaurant_id uuid, restaurant_name text,
   orders bigint, orders_with_offer bigint,
   markup numeric, delivery_fees numeric,
   cap_orders bigint, cap_cost numeric, gain_cap numeric, loss_orders_cap bigint,
   real_orders bigint, real_cost numeric, gain_real numeric, real_markup numeric, real_delivery_fees numeric,
   item_qty numeric, qty_ref_resto numeric, qty_ref_version numeric, qty_ref_grid numeric, qty_no_ref numeric,
   real_total numeric, real_service_fees numeric, chataigne_fees numeric, stripe_fees numeric, avg_distance_km numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  ),
  c0 AS (
    SELECT x.*, CASE WHEN p_scope = 'all' THEN x.offer_kind <> 'article_offert' ELSE x.no_offer END AS inc
    FROM public.chataigne_delivery_gain_core(p_start, p_end, (SELECT a FROM ids)::uuid[]) x
  ),
  c AS (
    SELECT c0.*,
      -- frais de service et frais estimés : seulement pour les commandes qui entrent dans le gain
      CASE WHEN c0.inc AND c0.real_cost IS NOT NULL THEN COALESCE((
        SELECT SUM((x.value -> 'amount' ->> 'amount')::numeric)
        FROM public.chataigne_orders o,
          jsonb_array_elements(CASE WHEN jsonb_typeof(o.raw_payload -> 'charges') = 'array' THEN o.raw_payload -> 'charges' ELSE '[]'::jsonb END) x
        WHERE o.id = c0.order_id AND x.value ->> 'type' = 'service'), 0) END AS svc,
      f.chataigne_fee_eur AS chat,
      ROUND(c0.total_amount * f.stripe_pct + f.stripe_fixed_eur, 2) AS stripe
    FROM c0 LEFT JOIN public.chataigne_channel_fees f ON f.chain_id = c0.chain_id
  ),
  agg AS (
    SELECT c.restaurant_id AS rid,
      COUNT(*) FILTER (WHERE c.inc) AS orders, COUNT(*) FILTER (WHERE NOT c.inc) AS with_offer,
      SUM(c.markup) FILTER (WHERE c.inc) AS markup, SUM(c.delivery_fee) FILTER (WHERE c.inc) AS fees,
      COUNT(c.cap_cost) FILTER (WHERE c.inc) AS cap_orders, SUM(c.cap_cost) FILTER (WHERE c.inc) AS cap_cost,
      SUM(c.markup + c.delivery_fee - c.cap_cost) FILTER (WHERE c.inc) AS gain_cap,
      COUNT(*) FILTER (WHERE c.inc AND c.markup + c.delivery_fee - c.cap_cost < 0) AS loss_cap,
      COUNT(c.real_cost) FILTER (WHERE c.inc) AS real_orders, SUM(c.real_cost) FILTER (WHERE c.inc) AS real_cost,
      SUM(c.markup + c.delivery_fee - c.real_cost) FILTER (WHERE c.inc) AS gain_real,
      SUM(c.markup) FILTER (WHERE c.inc AND c.real_cost IS NOT NULL) AS real_markup,
      SUM(c.delivery_fee) FILTER (WHERE c.inc AND c.real_cost IS NOT NULL) AS real_fees,
      SUM(c.item_qty) FILTER (WHERE c.inc) qty, SUM(c.qty_ref_resto) FILTER (WHERE c.inc) q_resto,
      SUM(c.qty_ref_version) FILTER (WHERE c.inc) q_version, SUM(c.qty_ref_grid) FILTER (WHERE c.inc) q_grid,
      SUM(c.qty_no_ref) FILTER (WHERE c.inc) q_none,
      SUM(c.total_amount) FILTER (WHERE c.inc AND c.real_cost IS NOT NULL) AS real_total,
      SUM(c.svc) AS real_svc,
      SUM(c.chat) FILTER (WHERE c.inc AND c.real_cost IS NOT NULL) AS chat,
      SUM(c.stripe) FILTER (WHERE c.inc AND c.real_cost IS NOT NULL) AS stripe,
      AVG(c.distance_km) FILTER (WHERE c.inc AND c.real_cost IS NOT NULL) AS km
    FROM c GROUP BY c.restaurant_id
  )
  SELECT r.id, r.name::text,
    a.orders::bigint, a.with_offer::bigint,
    ROUND(COALESCE(a.markup, 0), 2), ROUND(COALESCE(a.fees, 0), 2),
    a.cap_orders::bigint, ROUND(a.cap_cost, 2), ROUND(a.gain_cap, 2), a.loss_cap::bigint,
    a.real_orders::bigint, ROUND(a.real_cost, 2), ROUND(a.gain_real, 2), ROUND(a.real_markup, 2), ROUND(a.real_fees, 2),
    COALESCE(a.qty, 0), COALESCE(a.q_resto, 0), COALESCE(a.q_version, 0), COALESCE(a.q_grid, 0), COALESCE(a.q_none, 0),
    ROUND(a.real_total, 2), ROUND(a.real_svc, 2), ROUND(a.chat, 2), ROUND(a.stripe, 2), ROUND(a.km, 1)
  FROM agg a JOIN public.restaurants r ON r.id = a.rid
  ORDER BY r.name;
$function$;
REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[], text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Détail par commande. total_amount = total hors offre ; discount = remise accordée ; paid_amount = payé réellement.
DROP FUNCTION IF EXISTS public.get_chataigne_delivery_gain_orders(date, date, uuid);
DROP FUNCTION IF EXISTS public.get_chataigne_delivery_gain_orders(date, date, uuid, text);
CREATE FUNCTION public.get_chataigne_delivery_gain_orders(p_start date, p_end date, p_restaurant_id uuid, p_scope text DEFAULT 'no_offer')
 RETURNS TABLE(order_id uuid, short_id text, order_datetime timestamptz, total_amount numeric,
   markup numeric, delivery_fee numeric, real_cost numeric, cap_cost numeric, distance_km numeric,
   gain_cap numeric, gain_real numeric, items_without_ref numeric,
   service_fee numeric, items_delivery numeric, items_takeaway numeric,
   chataigne_fee numeric, stripe_fee numeric, service_balance numeric, full_result numeric,
   offer_kind text, offer_label text, discount numeric, paid_amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = p_restaurant_id AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  ),
  c AS (
    SELECT c.*,
      COALESCE((
        SELECT SUM((x.value -> 'amount' ->> 'amount')::numeric)
        FROM public.chataigne_orders o,
          jsonb_array_elements(CASE WHEN jsonb_typeof(o.raw_payload -> 'charges') = 'array' THEN o.raw_payload -> 'charges' ELSE '[]'::jsonb END) x
        WHERE o.id = c.order_id AND x.value ->> 'type' = 'service'), 0) AS svc
    FROM public.chataigne_delivery_gain_core(p_start, p_end, (SELECT a FROM ids)::uuid[]) c
    WHERE CASE WHEN p_scope = 'all' THEN c.offer_kind <> 'article_offert' ELSE c.no_offer END
  ),
  k AS (
    SELECT c.*, f.chataigne_fee_eur AS chat,
      ROUND(c.total_amount * f.stripe_pct + f.stripe_fixed_eur, 2) AS stripe
    FROM c LEFT JOIN public.chataigne_channel_fees f ON f.chain_id = c.chain_id
  )
  SELECT k.order_id, k.short_id, k.order_datetime, k.total_amount,
    ROUND(k.markup, 2), ROUND(k.delivery_fee, 2), ROUND(k.real_cost, 2), ROUND(k.cap_cost, 2), ROUND(k.distance_km, 1),
    ROUND(k.markup + k.delivery_fee - k.cap_cost, 2), ROUND(k.markup + k.delivery_fee - k.real_cost, 2), k.qty_no_ref,
    ROUND(k.svc, 2),
    -- total hors offre = articles + frais de livraison + frais de service
    ROUND(k.total_amount - k.delivery_fee - k.svc, 2),
    ROUND(k.total_amount - k.delivery_fee - k.svc - k.markup, 2),
    k.chat, k.stripe,
    ROUND(k.svc - k.chat - k.stripe, 2),
    ROUND(k.markup + k.delivery_fee - k.real_cost + k.svc - k.chat - k.stripe, 2),
    k.offer_kind, k.offer_label, ROUND(k.discount, 2), ROUND(k.total_amount - k.discount, 2)
  FROM k
  ORDER BY k.order_datetime DESC;
$function$;
REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Vue par offre : une ligne par famille d'offre, sur les commandes dont la course Uber Direct est connue
-- (orders = toutes les commandes livrées de la famille, discounts_all = remises accordées sur toutes).
CREATE OR REPLACE FUNCTION public.get_chataigne_delivery_gain_by_offer(p_start date, p_end date, p_restaurant_ids uuid[])
 RETURNS TABLE(offer_kind text, offer_labels text, orders bigint, real_orders bigint,
   items_delivery numeric, markup numeric, delivery_fees numeric, real_cost numeric, gain_real numeric,
   loss_orders bigint, discounts numeric, discounts_all numeric)
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
    SELECT x.*,
      CASE WHEN x.real_cost IS NOT NULL THEN COALESCE((
        SELECT SUM((s.value -> 'amount' ->> 'amount')::numeric)
        FROM public.chataigne_orders o,
          jsonb_array_elements(CASE WHEN jsonb_typeof(o.raw_payload -> 'charges') = 'array' THEN o.raw_payload -> 'charges' ELSE '[]'::jsonb END) s
        WHERE o.id = x.order_id AND s.value ->> 'type' = 'service'), 0) END AS svc
    FROM public.chataigne_delivery_gain_core(p_start, p_end, (SELECT a FROM ids)::uuid[]) x
  ),
  lab AS (
    SELECT t.offer_kind, string_agg(t.offer_label, ' · ' ORDER BY t.n DESC) AS labels
    FROM (SELECT c.offer_kind, c.offer_label, COUNT(*) n, ROW_NUMBER() OVER (PARTITION BY c.offer_kind ORDER BY COUNT(*) DESC) rk
          FROM c WHERE c.offer_label IS NOT NULL GROUP BY 1, 2) t
    WHERE t.rk <= 4 GROUP BY t.offer_kind
  )
  SELECT c.offer_kind, MAX(lab.labels),
    COUNT(*)::bigint, COUNT(c.real_cost)::bigint,
    ROUND(SUM(c.total_amount - c.delivery_fee - c.svc) FILTER (WHERE c.real_cost IS NOT NULL), 2),
    ROUND(SUM(c.markup) FILTER (WHERE c.real_cost IS NOT NULL), 2),
    ROUND(SUM(c.delivery_fee) FILTER (WHERE c.real_cost IS NOT NULL), 2),
    ROUND(SUM(c.real_cost), 2),
    ROUND(SUM(c.markup + c.delivery_fee - c.real_cost), 2),
    COUNT(*) FILTER (WHERE c.markup + c.delivery_fee - c.real_cost < 0)::bigint,
    ROUND(SUM(c.discount) FILTER (WHERE c.real_cost IS NOT NULL), 2),
    ROUND(SUM(c.discount), 2)
  FROM c LEFT JOIN lab ON lab.offer_kind = c.offer_kind
  GROUP BY c.offer_kind
  ORDER BY array_position(ARRAY['none', 'bienvenue', 'parrainage', 'promo', 'article_offert'], c.offer_kind);
$function$;
REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain_by_offer(date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain_by_offer(date, date, uuid[]) TO authenticated, service_role;
