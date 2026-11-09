CREATE OR REPLACE VIEW public.uber_direct_cost_view WITH (security_invoker = true) AS
WITH base AS (
  SELECT m.delivery_id, m.chain_id, m.restaurant_id, m.external_id, m.created_at_uber,
         m.delivery_status, m.match_status, m.order_id,
         d.fee_cents, d.basket_value_cents AS total_paid_cents, d.products_gross_cents,
         COALESCE(d.discount_cents,0) AS discount_cents,
         COALESCE(d.client_delivery_fee_cents,0) AS dlv_cents,
         COALESCE(d.client_service_fee_cents,0) AS svc_cents,
         o.discounts,
         round(o.total_amount*100)::int AS chat_total_cents,
         (SELECT round(COALESCE(sum((c->'amount'->>'amount')::numeric),0)*100)::int
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.raw_payload->'charges')='array' THEN o.raw_payload->'charges' ELSE '[]'::jsonb END) c) AS chat_charges_cents
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
      WHEN l.labelled_cents IS NOT DISTINCT FROM l.discount_cents AND l.targets = ARRAY['produits'] THEN 'produits'
      WHEN l.labelled_cents IS NOT DISTINCT FROM l.discount_cents AND l.targets = ARRAY['livraison'] THEN 'livraison'
      -- Preuve : libellé produits, total et frais Châtaigne identiques au centime, l'écart restant est un écart de prix produits
      WHEN l.labelled_cents IS NOT NULL AND l.targets = ARRAY['produits']
        AND l.chat_total_cents = l.total_paid_cents
        AND l.chat_charges_cents = l.dlv_cents + l.svc_cents
        AND (l.discount_cents - l.labelled_cents) = l.products_gross_cents - (l.chat_total_cents + l.labelled_cents - l.chat_charges_cents)
        THEN 'produits_prouve'
      ELSE 'a_verifier' END AS attribution,
    l.dlv_cents + l.svc_cents AS fees_displayed_cents
  FROM lab l
), hyp AS (
  SELECT c.*,
    LEAST(c.fees_displayed_cents, GREATEST(0, c.total_paid_cents - GREATEST(0, c.products_gross_cents - c.discount_cents))) AS fees_h_produits,
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
  CASE WHEN attribution='detail_absent' THEN NULL ELSE fee_cents - LEAST(fees_h_produits, fees_h_livraison) END AS reste_a_charge_max_cents,
  chat_total_cents, chat_charges_cents
FROM hyp;
GRANT SELECT ON public.uber_direct_cost_view TO authenticated, service_role;