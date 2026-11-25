-- Gain livraison WhatsApp : détail commande par commande + coût réel Uber Direct.
--
-- Le calcul est fait une seule fois, par commande, dans chataigne_delivery_gain_core (interne, sans contrôle
-- d'accès, non appelable par les utilisateurs). Deux fonctions publiques s'appuient dessus après avoir vérifié
-- l'accès à l'enseigne :
--   get_chataigne_delivery_gain         : une ligne par restaurant (inchangée) ;
--   get_chataigne_delivery_gain_orders  : une ligne par commande livrée sans offre client.
-- Règles et sources : voir 20261125120000_gain_livraison_whatsapp.sql.

CREATE OR REPLACE FUNCTION public.chataigne_delivery_gain_core(p_start date, p_end date, p_restaurant_ids uuid[])
 RETURNS TABLE(order_id uuid, short_id text, restaurant_id uuid, chain_id uuid, order_datetime timestamptz, no_offer boolean,
   total_amount numeric, delivery_fee numeric, markup numeric,
   item_qty numeric, qty_ref_resto numeric, qty_ref_version numeric, qty_ref_grid numeric, qty_no_ref numeric,
   real_cost numeric, distance_km numeric, cap_cost numeric)
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
  del AS (
    SELECT o.id, o.chataigne_order_id, o.restaurant_id AS rid, o.chain_id, o.short_id, o.order_datetime, o.total_amount,
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
    SELECT m.order_id, SUM(m.fee_cents) / 100.0 AS fee, MAX(dd.distance_km) AS km
    FROM public.uber_direct_cost_mv m
    LEFT JOIN public.uber_direct_deliveries dd ON dd.id = m.delivery_id
    WHERE m.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
      AND m.paris_date BETWEEN p_start - 1 AND p_end + 1
      AND m.match_status = 'apparie' AND m.order_id IS NOT NULL AND m.fee_cents IS NOT NULL
    GROUP BY m.order_id
  )
  SELECT d.id, d.short_id, d.rid, d.chain_id, d.order_datetime, d.no_offer, d.total_amount,
    o.fee, CASE WHEN d.no_offer THEN COALESCE(mk.markup, 0) END,
    COALESCE(mk.qty, 0), COALESCE(mk.q_resto, 0), COALESCE(mk.q_version, 0), COALESCE(mk.q_grid, 0), COALESCE(mk.q_none, 0),
    ud.fee, ud.km,
    -- Avec l'offre : au plus le plafond. Sans prix réel connu, on retient le plafond. Hors offre : prix réel.
    CASE WHEN cap.cap_cents IS NOT NULL THEN LEAST(COALESCE(ud.fee, cap.cap_cents / 100.0), cap.cap_cents / 100.0) ELSE ud.fee END
  FROM del d
  LEFT JOIN ord o ON o.id = d.id
  LEFT JOIN mk ON mk.id = d.id
  LEFT JOIN ud ON ud.order_id = d.id
  LEFT JOIN public.uber_direct_offer_caps cap ON cap.chain_id = d.chain_id AND d.d BETWEEN cap.valid_from AND cap.valid_to;
$function$;

REVOKE ALL ON FUNCTION public.chataigne_delivery_gain_core(date, date, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chataigne_delivery_gain_core(date, date, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.get_chataigne_delivery_gain(p_start date, p_end date, p_restaurant_ids uuid[])
 RETURNS TABLE(
   restaurant_id uuid, restaurant_name text,
   orders bigint, orders_with_offer bigint,
   markup numeric, delivery_fees numeric,
   cap_orders bigint, cap_cost numeric, gain_cap numeric, loss_orders_cap bigint,
   real_orders bigint, real_cost numeric, gain_real numeric, real_markup numeric, real_delivery_fees numeric,
   item_qty numeric, qty_ref_resto numeric, qty_ref_version numeric, qty_ref_grid numeric, qty_no_ref numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  ),
  c AS (SELECT * FROM public.chataigne_delivery_gain_core(p_start, p_end, (SELECT a FROM ids)::uuid[])),
  agg AS (
    SELECT c.restaurant_id AS rid,
      COUNT(*) FILTER (WHERE c.no_offer) AS orders, COUNT(*) FILTER (WHERE NOT c.no_offer) AS with_offer,
      SUM(c.markup) FILTER (WHERE c.no_offer) AS markup, SUM(c.delivery_fee) FILTER (WHERE c.no_offer) AS fees,
      COUNT(c.cap_cost) FILTER (WHERE c.no_offer) AS cap_orders, SUM(c.cap_cost) FILTER (WHERE c.no_offer) AS cap_cost,
      SUM(c.markup + c.delivery_fee - c.cap_cost) FILTER (WHERE c.no_offer) AS gain_cap,
      COUNT(*) FILTER (WHERE c.no_offer AND c.markup + c.delivery_fee - c.cap_cost < 0) AS loss_cap,
      COUNT(c.real_cost) FILTER (WHERE c.no_offer) AS real_orders, SUM(c.real_cost) FILTER (WHERE c.no_offer) AS real_cost,
      SUM(c.markup + c.delivery_fee - c.real_cost) FILTER (WHERE c.no_offer) AS gain_real,
      SUM(c.markup) FILTER (WHERE c.no_offer AND c.real_cost IS NOT NULL) AS real_markup,
      SUM(c.delivery_fee) FILTER (WHERE c.no_offer AND c.real_cost IS NOT NULL) AS real_fees,
      SUM(c.item_qty) qty, SUM(c.qty_ref_resto) q_resto, SUM(c.qty_ref_version) q_version, SUM(c.qty_ref_grid) q_grid, SUM(c.qty_no_ref) q_none
    FROM c GROUP BY c.restaurant_id
  )
  SELECT r.id, r.name::text,
    a.orders::bigint, a.with_offer::bigint,
    ROUND(COALESCE(a.markup, 0), 2), ROUND(COALESCE(a.fees, 0), 2),
    a.cap_orders::bigint, ROUND(a.cap_cost, 2), ROUND(a.gain_cap, 2), a.loss_cap::bigint,
    a.real_orders::bigint, ROUND(a.real_cost, 2), ROUND(a.gain_real, 2), ROUND(a.real_markup, 2), ROUND(a.real_fees, 2),
    COALESCE(a.qty, 0), COALESCE(a.q_resto, 0), COALESCE(a.q_version, 0), COALESCE(a.q_grid, 0), COALESCE(a.q_none, 0)
  FROM agg a JOIN public.restaurants r ON r.id = a.rid
  ORDER BY r.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_chataigne_delivery_gain_orders(p_start date, p_end date, p_restaurant_id uuid)
 RETURNS TABLE(order_id uuid, short_id text, order_datetime timestamptz, total_amount numeric,
   markup numeric, delivery_fee numeric, real_cost numeric, cap_cost numeric, distance_km numeric,
   gain_cap numeric, gain_real numeric, items_without_ref numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = p_restaurant_id AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  )
  SELECT c.order_id, c.short_id, c.order_datetime, c.total_amount,
    ROUND(c.markup, 2), ROUND(c.delivery_fee, 2), ROUND(c.real_cost, 2), ROUND(c.cap_cost, 2), ROUND(c.distance_km, 1),
    ROUND(c.markup + c.delivery_fee - c.cap_cost, 2), ROUND(c.markup + c.delivery_fee - c.real_cost, 2), c.qty_no_ref
  FROM public.chataigne_delivery_gain_core(p_start, p_end, (SELECT a FROM ids)::uuid[]) c
  WHERE c.no_offer
  ORDER BY c.order_datetime DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain_orders(date, date, uuid) TO authenticated, service_role;
