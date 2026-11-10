
CREATE TABLE public.channel_cost_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  restaurant_id uuid REFERENCES public.restaurants(id),
  cost_key text NOT NULL CHECK (cost_key IN ('chataigne_fee_per_order_ht','stripe_pct','stripe_fixed_ht')),
  value numeric NOT NULL,
  unit text NOT NULL CHECK (unit IN ('cents','ratio')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  status text NOT NULL DEFAULT 'a_caler' CHECK (status IN ('certifie','a_caler','a_venir')),
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.channel_cost_settings IS 'Coûts canal Châtaigne historisés (HT, centimes). restaurant_id NULL = règle enseigne; non NULL = dérogation. status a_caler => jamais utilisé par les indicateurs.';

CREATE TABLE public.channel_pricing_regimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  code text NOT NULL,
  label text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  evidence text,
  UNIQUE (chain_id, code)
);
COMMENT ON TABLE public.channel_pricing_regimes IS 'Régimes tarifaires par enseigne déterminés depuis les données; toute agrégation est segmentée par régime, jamais moyennée à cheval.';

CREATE TABLE public.delivery_fee_grid (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_code text NOT NULL,
  max_km numeric NOT NULL,
  fee_ttc_cents integer NOT NULL,
  certified boolean NOT NULL DEFAULT false,
  notes text,
  UNIQUE (grid_code, max_km)
);

CREATE TABLE public.restaurant_delivery_grid (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  grid_type text NOT NULL CHECK (grid_type IN ('nationale','locale')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.restaurant_delivery_grid IS 'Flag grille nationale/locale historisé; absence de ligne = nationale.';

CREATE TABLE public.chataigne_product_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  restaurant_id uuid REFERENCES public.restaurants(id),
  chataigne_name_norm text NOT NULL,
  caisse_name_norm text NOT NULL,
  validated_by uuid NOT NULL,
  validated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE UNIQUE INDEX chataigne_product_mapping_uq ON public.chataigne_product_mapping (chain_id, COALESCE(restaurant_id,'00000000-0000-0000-0000-000000000000'::uuid), chataigne_name_norm);
COMMENT ON TABLE public.chataigne_product_mapping IS 'Correspondances produit Châtaigne -> produit caisse validées par un humain (jamais auto). restaurant_id NULL = règle enseigne. Le prix reste celui observé en caisse par restaurant.';

GRANT SELECT ON public.channel_cost_settings, public.channel_pricing_regimes, public.delivery_fee_grid, public.restaurant_delivery_grid, public.chataigne_product_mapping TO authenticated;
GRANT ALL ON public.channel_cost_settings, public.channel_pricing_regimes, public.delivery_fee_grid, public.restaurant_delivery_grid, public.chataigne_product_mapping TO service_role;

ALTER TABLE public.channel_cost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_pricing_regimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fee_grid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_delivery_grid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chataigne_product_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chain read" ON public.channel_cost_settings FOR SELECT TO authenticated USING (public.user_has_chain_access(chain_id));
CREATE POLICY "chain read" ON public.channel_pricing_regimes FOR SELECT TO authenticated USING (public.user_has_chain_access(chain_id));
CREATE POLICY "auth read" ON public.delivery_fee_grid FOR SELECT TO authenticated USING (true);
CREATE POLICY "chain read" ON public.restaurant_delivery_grid FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND public.user_has_chain_access(r.chain_id)));
CREATE POLICY "super admin read" ON public.chataigne_product_mapping FOR SELECT TO authenticated USING (public.is_super_admin());

-- Noms produits caisse normalisés par restaurant (3 derniers mois), prix unitaire majoritaire par mois
CREATE OR REPLACE FUNCTION public.norm_product_name(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(lower(regexp_replace(translate(coalesce(t,''),'éèêëàâäîïôöûüùçÉÈÊËÀÂÄÎÏÔÖÛÜÙÇ','eeeeaaaiioouuuceeeeaaaiioouuuc'),'\s+',' ','g')))
$$;

CREATE MATERIALIZED VIEW public.caisse_product_names_mv AS
SELECT chain_id, restaurant_id, public.norm_product_name(product_name) AS name_norm,
       min(product_name) AS sample_name, sum(quantity) AS qty
FROM public.caisse_ticket_lines
WHERE ticket_date >= (current_date - 92) AND depth = 0
GROUP BY 1,2,3;
CREATE UNIQUE INDEX caisse_product_names_mv_pk ON public.caisse_product_names_mv (restaurant_id, name_norm);
CREATE INDEX caisse_product_names_mv_chain ON public.caisse_product_names_mv (chain_id, name_norm);
REVOKE ALL ON public.caisse_product_names_mv FROM anon, authenticated;
GRANT SELECT ON public.caisse_product_names_mv TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_caisse_product_names_mv() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '600s' AS $$
BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.caisse_product_names_mv; END $$;
REVOKE ALL ON FUNCTION public.refresh_caisse_product_names_mv() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_caisse_product_names_mv() TO service_role;

-- Non-mappés triés par CA, par enseigne
CREATE OR REPLACE FUNCTION public.get_chataigne_unmapped_products(p_chain_id uuid, p_start date, p_end date)
RETURNS TABLE(chataigne_name_norm text, sample_name text, n_lines bigint, ca_ttc numeric, n_restaurants bigint, n_restaurants_unmapped bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '60s' AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH co AS (
    SELECT i.restaurant_id, public.norm_product_name(i.item_name) n, i.item_name, i.quantity * i.unit_price_amount ca
    FROM public.chataigne_order_items i
    JOIN public.chataigne_orders o ON o.chataigne_order_id = i.chataigne_order_id
    WHERE o.chain_id = p_chain_id AND o.status = 'completed' AND i.depth = 0
      AND i.order_datetime >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')
      AND i.order_datetime <  ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  ), j AS (
    SELECT co.*, (
      EXISTS (SELECT 1 FROM public.caisse_product_names_mv m WHERE m.restaurant_id = co.restaurant_id AND m.name_norm = co.n)
      OR EXISTS (SELECT 1 FROM public.chataigne_product_mapping pm
                 JOIN public.caisse_product_names_mv m ON m.restaurant_id = co.restaurant_id AND m.name_norm = pm.caisse_name_norm
                 WHERE pm.chain_id = p_chain_id AND pm.chataigne_name_norm = co.n
                   AND (pm.restaurant_id IS NULL OR pm.restaurant_id = co.restaurant_id))
    ) mapped FROM co
  )
  SELECT j.n, min(j.item_name), count(*), round(sum(j.ca),2), count(DISTINCT j.restaurant_id),
         count(DISTINCT j.restaurant_id) FILTER (WHERE NOT j.mapped)
  FROM j GROUP BY j.n
  HAVING bool_or(NOT j.mapped)
  ORDER BY sum(j.ca) FILTER (WHERE NOT j.mapped) DESC NULLS LAST;
END $$;

CREATE OR REPLACE FUNCTION public.get_chataigne_mapping_coverage(p_chain_id uuid, p_start date, p_end date)
RETURNS TABLE(n_lines bigint, n_mapped bigint, ca_ttc numeric, ca_mapped numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '60s' AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH co AS (
    SELECT i.restaurant_id, public.norm_product_name(i.item_name) n, i.quantity * i.unit_price_amount ca
    FROM public.chataigne_order_items i JOIN public.chataigne_orders o ON o.chataigne_order_id = i.chataigne_order_id
    WHERE o.chain_id = p_chain_id AND o.status = 'completed' AND i.depth = 0
      AND i.order_datetime >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')
      AND i.order_datetime <  ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  ), j AS (
    SELECT co.ca, (
      EXISTS (SELECT 1 FROM public.caisse_product_names_mv m WHERE m.restaurant_id = co.restaurant_id AND m.name_norm = co.n)
      OR EXISTS (SELECT 1 FROM public.chataigne_product_mapping pm
                 JOIN public.caisse_product_names_mv m ON m.restaurant_id = co.restaurant_id AND m.name_norm = pm.caisse_name_norm
                 WHERE pm.chain_id = p_chain_id AND pm.chataigne_name_norm = co.n
                   AND (pm.restaurant_id IS NULL OR pm.restaurant_id = co.restaurant_id))) mapped
    FROM co)
  SELECT count(*), count(*) FILTER (WHERE mapped), round(sum(ca),2), round(sum(ca) FILTER (WHERE mapped),2) FROM j;
END $$;

CREATE OR REPLACE FUNCTION public.get_caisse_product_candidates(p_chain_id uuid)
RETURNS TABLE(name_norm text, sample_name text, n_restaurants bigint, qty numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT m.name_norm, min(m.sample_name), count(*), sum(m.qty)::numeric
  FROM public.caisse_product_names_mv m WHERE m.chain_id = p_chain_id GROUP BY m.name_norm ORDER BY sum(m.qty) DESC;
END $$;

CREATE OR REPLACE FUNCTION public.set_chataigne_product_mapping(p_chain_id uuid, p_chataigne_name_norm text, p_caisse_name_norm text, p_restaurant_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.caisse_product_names_mv WHERE chain_id = p_chain_id AND name_norm = p_caisse_name_norm) THEN
    RAISE EXCEPTION 'produit caisse inconnu pour cette enseigne';
  END IF;
  DELETE FROM public.chataigne_product_mapping WHERE chain_id = p_chain_id AND chataigne_name_norm = p_chataigne_name_norm
    AND restaurant_id IS NOT DISTINCT FROM p_restaurant_id;
  INSERT INTO public.chataigne_product_mapping (chain_id, restaurant_id, chataigne_name_norm, caisse_name_norm, validated_by)
  VALUES (p_chain_id, p_restaurant_id, p_chataigne_name_norm, p_caisse_name_norm, auth.uid());
END $$;

REVOKE ALL ON FUNCTION public.get_chataigne_unmapped_products(uuid,date,date), public.get_chataigne_mapping_coverage(uuid,date,date), public.get_caisse_product_candidates(uuid), public.set_chataigne_product_mapping(uuid,text,text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_unmapped_products(uuid,date,date), public.get_chataigne_mapping_coverage(uuid,date,date), public.get_caisse_product_candidates(uuid), public.set_chataigne_product_mapping(uuid,text,text,uuid) TO authenticated;

SELECT cron.schedule('refresh-caisse-product-names', '15 5 * * *', $$SELECT public.refresh_caisse_product_names_mv()$$);
