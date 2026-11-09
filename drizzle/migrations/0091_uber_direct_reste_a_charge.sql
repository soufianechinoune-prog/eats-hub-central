CREATE OR REPLACE FUNCTION public.uber_direct_promo_target(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _name IS NULL OR btrim(_name) = '' THEN 'inconnu'
    WHEN _name ILIKE '%livraison%' OR _name ILIKE '%frais%' OR _name ILIKE '%delivery%' THEN 'livraison'
    WHEN _name ILIKE 'Promo de bienvenue%' OR _name ILIKE 'Offre de bienvenue%'
      OR _name ILIKE '%Clients fid%' OR _name ILIKE '%Parrainage%'
      OR _name ILIKE 'Referral Reward%' OR _name ILIKE '1 ACHET% = 1 OFFERT%' THEN 'produits'
    ELSE 'inconnu' END
$$;

CREATE OR REPLACE VIEW public.uber_direct_cost_view WITH (security_invoker = true) AS
WITH base AS (
  SELECT m.delivery_id, m.chain_id, m.restaurant_id, m.external_id, m.created_at_uber,
         m.delivery_status, m.match_status, m.order_id,
         d.fee_cents, d.basket_value_cents AS total_paid_cents, d.products_gross_cents,
         COALESCE(d.discount_cents,0) AS discount_cents,
         COALESCE(d.client_delivery_fee_cents,0) AS dlv_cents,
         COALESCE(d.client_service_fee_cents,0) AS svc_cents,
         o.discounts
  FROM public.uber_direct_order_match m
  JOIN public.uber_direct_deliveries d ON d.id = m.delivery_id
  LEFT JOIN public.chataigne_orders o ON o.id = m.order_id
), lab AS (
  SELECT b.*,
    (SELECT round(sum((e->>'amount')::numeric)*100)::int FROM jsonb_array_elements(CASE WHEN jsonb_typeof(b.discounts)='array' THEN b.discounts ELSE '[]'::jsonb END) e) AS labelled_cents,
    (SELECT array_agg(DISTINCT public.uber_direct_promo_target(e->>'name')) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(b.discounts)='array' THEN b.discounts ELSE '[]'::jsonb END) e) AS targets,
    (SELECT string_agg(DISTINCT e->>'name', ' | ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(b.discounts)='array' THEN b.discounts ELSE '[]'::jsonb END) e) AS promo_labels
  FROM base b
), cls AS (
  SELECT l.*,
    CASE
      WHEN l.products_gross_cents IS NULL OR l.fee_cents IS NULL THEN 'detail_absent'
      WHEN l.discount_cents = 0 THEN 'sans_remise'
      WHEN l.labelled_cents IS DISTINCT FROM l.discount_cents THEN 'a_verifier'
      WHEN l.targets = ARRAY['produits'] THEN 'produits'
      WHEN l.targets = ARRAY['livraison'] THEN 'livraison'
      ELSE 'a_verifier' END AS attribution,
    l.dlv_cents + l.svc_cents AS fees_displayed_cents
  FROM lab l
), hyp AS (
  SELECT c.*,
    -- H produits : remise imputée aux produits, l'excédent absorbe livraison puis service
    LEAST(c.fees_displayed_cents, GREATEST(0, c.total_paid_cents - GREATEST(0, c.products_gross_cents - c.discount_cents))) AS fees_h_produits,
    -- H livraison : remise imputée à la livraison puis au service d'abord
    LEAST(GREATEST(0, c.fees_displayed_cents - c.discount_cents), GREATEST(0, c.total_paid_cents)) AS fees_h_livraison
  FROM cls c
)
SELECT delivery_id, chain_id, restaurant_id, external_id, created_at_uber,
  (created_at_uber AT TIME ZONE 'Europe/Paris')::date AS paris_date,
  delivery_status, match_status, order_id, fee_cents, total_paid_cents, products_gross_cents,
  discount_cents, labelled_cents, promo_labels, dlv_cents, svc_cents, fees_displayed_cents, attribution,
  CASE attribution WHEN 'detail_absent' THEN NULL WHEN 'livraison' THEN fees_h_livraison WHEN 'a_verifier' THEN NULL ELSE fees_h_produits END AS fees_collected_cents,
  CASE WHEN attribution='detail_absent' THEN NULL ELSE LEAST(fees_h_produits, fees_h_livraison) END AS fees_collected_min_cents,
  CASE WHEN attribution='detail_absent' THEN NULL ELSE GREATEST(fees_h_produits, fees_h_livraison) END AS fees_collected_max_cents,
  CASE attribution WHEN 'detail_absent' THEN NULL WHEN 'livraison' THEN fee_cents - fees_h_livraison WHEN 'a_verifier' THEN NULL ELSE fee_cents - fees_h_produits END AS reste_a_charge_cents,
  CASE WHEN attribution='detail_absent' THEN NULL ELSE fee_cents - GREATEST(fees_h_produits, fees_h_livraison) END AS reste_a_charge_min_cents,
  CASE WHEN attribution='detail_absent' THEN NULL ELSE fee_cents - LEAST(fees_h_produits, fees_h_livraison) END AS reste_a_charge_max_cents
FROM hyp;

COMMENT ON VIEW public.uber_direct_cost_view IS 'Reste à charge Uber Direct par course. Positif = coût pour le restaurant. Attribution de remise par type de promo; a_verifier = fourchette (min/max), jamais la version flatteuse seule; detail_absent = pas de manifest_items, non calculé.';
COMMENT ON COLUMN public.uber_direct_order_match.reste_a_charge_cents IS 'DEPRECATED: signe inversé et frais affichés; utiliser uber_direct_cost_view.reste_a_charge_cents';

GRANT SELECT ON public.uber_direct_cost_view TO authenticated;
GRANT SELECT ON public.uber_direct_cost_view TO service_role;

CREATE OR REPLACE FUNCTION public.get_uber_direct_cost_summary(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(restaurant_id uuid, courses bigint, courses_livrees bigint, fee_cents bigint,
  fees_collected_cents bigint, reste_a_charge_cents bigint,
  fee_calc_cents bigint, n_calcules bigint, n_a_verifier bigint, n_detail_absent bigint,
  rac_a_verifier_min_cents bigint, rac_a_verifier_max_cents bigint, n_non_apparies bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.restaurant_id, count(*), count(*) FILTER (WHERE v.delivery_status='delivered'),
    COALESCE(sum(v.fee_cents),0),
    COALESCE(sum(v.fees_collected_cents),0), COALESCE(sum(v.reste_a_charge_cents),0),
    COALESCE(sum(v.fee_cents) FILTER (WHERE v.reste_a_charge_cents IS NOT NULL),0),
    count(*) FILTER (WHERE v.reste_a_charge_cents IS NOT NULL),
    count(*) FILTER (WHERE v.attribution='a_verifier'),
    count(*) FILTER (WHERE v.attribution='detail_absent'),
    COALESCE(sum(v.reste_a_charge_min_cents) FILTER (WHERE v.attribution='a_verifier'),0),
    COALESCE(sum(v.reste_a_charge_max_cents) FILTER (WHERE v.attribution='a_verifier'),0),
    count(*) FILTER (WHERE v.match_status<>'apparie')
  FROM public.uber_direct_cost_view v
  WHERE v.restaurant_id = ANY(p_restaurant_ids)
    AND public.user_has_chain_access(v.chain_id)
    AND v.paris_date BETWEEN p_start AND p_end
  GROUP BY v.restaurant_id
$$;
GRANT EXECUTE ON FUNCTION public.get_uber_direct_cost_summary(uuid[], date, date) TO authenticated;