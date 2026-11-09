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
      WHEN l.labelled_cents IS NOT NULL AND l.targets = ARRAY['produits']
        AND l.chat_total_cents = l.total_paid_cents
        AND l.chat_charges_cents = l.dlv_cents + l.svc_cents
        AND (l.discount_cents - l.labelled_cents) = l.products_gross_cents - (l.chat_total_cents + l.labelled_cents - l.chat_charges_cents)
        THEN 'produits_prouve'
      WHEN l.labelled_cents IS NULL
        AND l.chat_total_cents = l.total_paid_cents
        AND l.chat_charges_cents = l.dlv_cents + l.svc_cents
        AND l.products_gross_cents - l.discount_cents = l.chat_total_cents - l.chat_charges_cents
        THEN 'ecart_prix'
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

DROP FUNCTION IF EXISTS public.get_uber_direct_cost_summary(uuid[], date, date);
CREATE FUNCTION public.get_uber_direct_cost_summary(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(restaurant_id uuid, courses bigint, courses_livrees bigint, fee_cents bigint,
  fees_collected_cents bigint, reste_a_charge_cents bigint,
  fee_calc_cents bigint, n_calcules bigint, n_a_verifier bigint, n_detail_absent bigint,
  rac_a_verifier_min_cents bigint, rac_a_verifier_max_cents bigint, n_non_apparies bigint,
  n_ecart_prix bigint, n_produits_prouve bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(r.id) INTO v_ids FROM public.restaurants r
  WHERE r.id = ANY(p_restaurant_ids)
    AND r.chain_id IN (SELECT c.id FROM public.chains c WHERE public.user_has_chain_access(c.id));
  IF v_ids IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT v.restaurant_id, count(*), count(*) FILTER (WHERE v.delivery_status='delivered'),
    COALESCE(sum(v.fee_cents),0)::bigint,
    COALESCE(sum(v.fees_collected_cents),0)::bigint, COALESCE(sum(v.reste_a_charge_cents),0)::bigint,
    COALESCE(sum(v.fee_cents) FILTER (WHERE v.reste_a_charge_cents IS NOT NULL),0)::bigint,
    count(*) FILTER (WHERE v.reste_a_charge_cents IS NOT NULL),
    count(*) FILTER (WHERE v.attribution='a_verifier'),
    count(*) FILTER (WHERE v.attribution='detail_absent'),
    COALESCE(sum(v.reste_a_charge_min_cents) FILTER (WHERE v.attribution='a_verifier'),0)::bigint,
    COALESCE(sum(v.reste_a_charge_max_cents) FILTER (WHERE v.attribution='a_verifier'),0)::bigint,
    count(*) FILTER (WHERE v.match_status<>'apparie'),
    count(*) FILTER (WHERE v.attribution='ecart_prix'),
    count(*) FILTER (WHERE v.attribution='produits_prouve')
  FROM public.uber_direct_cost_view v
  WHERE v.restaurant_id = ANY(v_ids) AND v.paris_date BETWEEN p_start AND p_end
  GROUP BY v.restaurant_id;
END $$;
GRANT EXECUTE ON FUNCTION public.get_uber_direct_cost_summary(uuid[], date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_uber_direct_attention_list(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(delivery_id text, restaurant_id uuid, external_id text, created_at_uber timestamptz,
  attribution text, products_gross_cents int, discount_cents int, total_paid_cents int, fee_cents int,
  reste_a_charge_cents int, reste_a_charge_min_cents int, reste_a_charge_max_cents int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(r.id) INTO v_ids FROM public.restaurants r
  WHERE r.id = ANY(p_restaurant_ids)
    AND r.chain_id IN (SELECT c.id FROM public.chains c WHERE public.user_has_chain_access(c.id));
  IF v_ids IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT v.delivery_id, v.restaurant_id, v.external_id, v.created_at_uber, v.attribution,
    v.products_gross_cents, v.discount_cents, v.total_paid_cents, v.fee_cents,
    v.reste_a_charge_cents, v.reste_a_charge_min_cents, v.reste_a_charge_max_cents
  FROM public.uber_direct_cost_view v
  WHERE v.restaurant_id = ANY(v_ids) AND v.paris_date BETWEEN p_start AND p_end
    AND v.attribution IN ('ecart_prix','a_verifier')
  ORDER BY v.attribution, v.discount_cents DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.get_uber_direct_attention_list(uuid[], date, date) TO authenticated;