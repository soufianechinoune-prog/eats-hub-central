
CREATE OR REPLACE FUNCTION public.get_chataigne_orders_uber_costs(p_chataigne_order_ids text[])
RETURNS TABLE(chataigne_order_id text, delivery_id text, match_status text, attribution text,
  fee_cents integer, dlv_displayed_cents integer, svc_displayed_cents integer, discount_cents integer,
  total_paid_cents integer, products_gross_cents integer,
  fees_collected_cents integer, dlv_collected_cents integer, svc_collected_cents integer, reste_a_charge_cents integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_chataigne_order_ids IS NULL OR cardinality(p_chataigne_order_ids) = 0 OR cardinality(p_chataigne_order_ids) > 200 THEN RETURN; END IF;
  RETURN QUERY
  WITH o AS (
    SELECT co.id, co.chataigne_order_id FROM public.chataigne_orders co
    WHERE co.chataigne_order_id = ANY(p_chataigne_order_ids)
      AND co.chain_id IN (SELECT c.id FROM public.chains c WHERE public.user_has_chain_access(c.id))
  ), m AS (
    SELECT o.chataigne_order_id, v.*, count(*) OVER (PARTITION BY o.chataigne_order_id) n
    FROM o JOIN public.uber_direct_cost_mv v ON v.order_id = o.id
    WHERE v.match_status = 'apparie'
  )
  SELECT m.chataigne_order_id, m.delivery_id, m.match_status, m.attribution,
    m.fee_cents, m.dlv_cents, m.svc_cents, m.discount_cents, m.total_paid_cents, m.products_gross_cents,
    m.fees_collected_cents,
    -- Remise sur frais imputée d'abord sur la livraison : service encaissé = min(service affiché, frais encaissés)
    CASE WHEN m.fees_collected_cents IS NULL THEN NULL ELSE m.fees_collected_cents - LEAST(m.svc_cents, m.fees_collected_cents) END,
    CASE WHEN m.fees_collected_cents IS NULL THEN NULL ELSE LEAST(m.svc_cents, m.fees_collected_cents) END,
    m.reste_a_charge_cents
  FROM m WHERE m.n = 1;
END $$;
REVOKE ALL ON FUNCTION public.get_chataigne_orders_uber_costs(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_orders_uber_costs(text[]) TO authenticated;
