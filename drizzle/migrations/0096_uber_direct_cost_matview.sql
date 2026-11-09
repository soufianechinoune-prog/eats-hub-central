CREATE MATERIALIZED VIEW IF NOT EXISTS public.uber_direct_cost_mv AS SELECT * FROM public.uber_direct_cost_view;
CREATE UNIQUE INDEX IF NOT EXISTS uber_direct_cost_mv_pk ON public.uber_direct_cost_mv (delivery_id);
CREATE INDEX IF NOT EXISTS uber_direct_cost_mv_resto_date ON public.uber_direct_cost_mv (restaurant_id, paris_date);
REVOKE ALL ON public.uber_direct_cost_mv FROM anon, authenticated;
GRANT SELECT ON public.uber_direct_cost_mv TO service_role;
COMMENT ON MATERIALIZED VIEW public.uber_direct_cost_mv IS 'Projection recalculable de uber_direct_cost_view (source de vérité), lue par les RPC chain-scoped; rafraîchie après chaque sync et toutes les heures.';

CREATE OR REPLACE FUNCTION public.refresh_uber_direct_cost_mv()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.uber_direct_cost_mv;
END $$;
REVOKE ALL ON FUNCTION public.refresh_uber_direct_cost_mv() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_uber_direct_cost_mv() TO service_role;

CREATE OR REPLACE FUNCTION public.get_uber_direct_cost_summary(p_restaurant_ids uuid[], p_start date, p_end date)
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
  FROM public.uber_direct_cost_mv v
  WHERE v.restaurant_id = ANY(v_ids) AND v.paris_date BETWEEN p_start AND p_end
  GROUP BY v.restaurant_id;
END $$;

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
  FROM public.uber_direct_cost_mv v
  WHERE v.restaurant_id = ANY(v_ids) AND v.paris_date BETWEEN p_start AND p_end
    AND v.attribution IN ('ecart_prix','a_verifier')
  ORDER BY v.attribution, v.discount_cents DESC;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.schedule('uber-direct-cost-mv-refresh', '7 * * * *', 'SELECT public.refresh_uber_direct_cost_mv()');
  END IF;
END $$;