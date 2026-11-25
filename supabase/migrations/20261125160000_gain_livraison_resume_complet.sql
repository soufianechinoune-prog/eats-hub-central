-- Gain livraison WhatsApp : la ligne de chaque restaurant porte les mêmes colonnes que le détail des commandes
-- (demande Soufiane, 25/11/2026) : total payé, frais de service, frais Châtaigne et Stripe estimés, distance.
-- Ces nouveaux montants portent sur les commandes sans offre dont la course Uber Direct est connue
-- (les mêmes que real_orders / real_markup / real_delivery_fees / gain_real).
-- Contrôle Reims 1 → 24/11/2026 : total payé 730,89 €, frais de service 41,79 €, Châtaigne 21,00 €,
-- Stripe 16,19 € → résultat complet +0,49 € (identique au détail par commande).

DROP FUNCTION IF EXISTS public.get_chataigne_delivery_gain(date, date, uuid[]);
CREATE FUNCTION public.get_chataigne_delivery_gain(p_start date, p_end date, p_restaurant_ids uuid[])
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
  c0 AS (SELECT * FROM public.chataigne_delivery_gain_core(p_start, p_end, (SELECT a FROM ids)::uuid[])),
  c AS (
    SELECT c0.*,
      -- frais de service et frais estimés : seulement pour les commandes qui entrent dans le gain
      CASE WHEN c0.no_offer AND c0.real_cost IS NOT NULL THEN COALESCE((
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
      COUNT(*) FILTER (WHERE c.no_offer) AS orders, COUNT(*) FILTER (WHERE NOT c.no_offer) AS with_offer,
      SUM(c.markup) FILTER (WHERE c.no_offer) AS markup, SUM(c.delivery_fee) FILTER (WHERE c.no_offer) AS fees,
      COUNT(c.cap_cost) FILTER (WHERE c.no_offer) AS cap_orders, SUM(c.cap_cost) FILTER (WHERE c.no_offer) AS cap_cost,
      SUM(c.markup + c.delivery_fee - c.cap_cost) FILTER (WHERE c.no_offer) AS gain_cap,
      COUNT(*) FILTER (WHERE c.no_offer AND c.markup + c.delivery_fee - c.cap_cost < 0) AS loss_cap,
      COUNT(c.real_cost) FILTER (WHERE c.no_offer) AS real_orders, SUM(c.real_cost) FILTER (WHERE c.no_offer) AS real_cost,
      SUM(c.markup + c.delivery_fee - c.real_cost) FILTER (WHERE c.no_offer) AS gain_real,
      SUM(c.markup) FILTER (WHERE c.no_offer AND c.real_cost IS NOT NULL) AS real_markup,
      SUM(c.delivery_fee) FILTER (WHERE c.no_offer AND c.real_cost IS NOT NULL) AS real_fees,
      SUM(c.item_qty) qty, SUM(c.qty_ref_resto) q_resto, SUM(c.qty_ref_version) q_version, SUM(c.qty_ref_grid) q_grid, SUM(c.qty_no_ref) q_none,
      SUM(c.total_amount) FILTER (WHERE c.no_offer AND c.real_cost IS NOT NULL) AS real_total,
      SUM(c.svc) AS real_svc,
      SUM(c.chat) FILTER (WHERE c.no_offer AND c.real_cost IS NOT NULL) AS chat,
      SUM(c.stripe) FILTER (WHERE c.no_offer AND c.real_cost IS NOT NULL) AS stripe,
      AVG(c.distance_km) FILTER (WHERE c.no_offer AND c.real_cost IS NOT NULL) AS km
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
REVOKE ALL ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_delivery_gain(date, date, uuid[]) TO authenticated, service_role;
