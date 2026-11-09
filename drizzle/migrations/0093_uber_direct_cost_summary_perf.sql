CREATE OR REPLACE FUNCTION public.get_uber_direct_cost_summary(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(restaurant_id uuid, courses bigint, courses_livrees bigint, fee_cents bigint,
  fees_collected_cents bigint, reste_a_charge_cents bigint,
  fee_calc_cents bigint, n_calcules bigint, n_a_verifier bigint, n_detail_absent bigint,
  rac_a_verifier_min_cents bigint, rac_a_verifier_max_cents bigint, n_non_apparies bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- Contrôle d'accès évalué une fois par enseigne, pas par course
  SELECT array_agg(r.id) INTO v_ids
  FROM public.restaurants r
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
    count(*) FILTER (WHERE v.match_status<>'apparie')
  FROM public.uber_direct_cost_view v
  WHERE v.restaurant_id = ANY(v_ids)
    AND v.paris_date BETWEEN p_start AND p_end
  GROUP BY v.restaurant_id;
END
$$;
GRANT EXECUTE ON FUNCTION public.get_uber_direct_cost_summary(uuid[], date, date) TO authenticated;