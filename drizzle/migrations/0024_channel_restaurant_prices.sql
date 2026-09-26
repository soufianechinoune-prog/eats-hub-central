CREATE TABLE public.channel_restaurant_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('uber', 'deliveroo', 'dishop', 'chataigne')),
  product_key text NOT NULL,
  product_label text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  source text NOT NULL DEFAULT 'import',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, channel, product_key),
  CHECK (length(product_key) BETWEEN 1 AND 160),
  CHECK (length(product_label) BETWEEN 1 AND 300)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_restaurant_prices TO authenticated;
GRANT ALL ON public.channel_restaurant_prices TO service_role;
ALTER TABLE public.channel_restaurant_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chain access read channel prices" ON public.channel_restaurant_prices FOR SELECT TO authenticated USING (public.user_has_chain_access(chain_id));
CREATE INDEX channel_restaurant_prices_chain_idx ON public.channel_restaurant_prices (chain_id, channel);

CREATE OR REPLACE FUNCTION public.get_channel_price_matrix(p_chain_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_chain_id IS NULL OR NOT public.user_has_chain_access(p_chain_id) THEN '[]'::jsonb ELSE
  COALESCE((SELECT jsonb_agg(jsonb_build_object('key', product_key, 'label', label, 'channel', channel, 'prices', prices) ORDER BY label, channel)
   FROM (SELECT product_key, channel, max(product_label) label, jsonb_object_agg(restaurant_id, price) prices
         FROM public.channel_restaurant_prices WHERE chain_id = p_chain_id GROUP BY product_key, channel) t), '[]'::jsonb) END
$$;

CREATE OR REPLACE FUNCTION public.set_channel_restaurant_price(p_restaurant_id uuid, p_channel text, p_product_key text, p_product_label text, p_price numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_chain uuid;
BEGIN
  SELECT chain_id INTO v_chain FROM public.restaurants WHERE id = p_restaurant_id;
  IF v_chain IS NULL OR NOT public.user_has_chain_access(v_chain) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF p_channel IS NULL OR p_channel NOT IN ('uber', 'deliveroo', 'dishop', 'chataigne')
     OR length(p_product_key) NOT BETWEEN 1 AND 160 OR length(p_product_label) NOT BETWEEN 1 AND 300
     OR p_price IS NULL OR p_price < 0 OR p_price > 99999999.99 THEN RAISE EXCEPTION 'Prix ou produit invalide'; END IF;
  INSERT INTO public.channel_restaurant_prices (chain_id, restaurant_id, channel, product_key, product_label, price, source)
  VALUES (v_chain, p_restaurant_id, p_channel, p_product_key, p_product_label, p_price, 'manuel')
  ON CONFLICT (restaurant_id, channel, product_key) DO UPDATE SET price = EXCLUDED.price, product_label = EXCLUDED.product_label, source = 'manuel', updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.import_channel_restaurant_prices(p_chain_id uuid, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF p_chain_id IS NULL OR NOT public.user_has_chain_access(p_chain_id) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) > 2000 THEN RAISE EXCEPTION 'Lot invalide'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE r->>'channel' IS NULL OR r->>'channel' NOT IN ('uber', 'deliveroo', 'dishop', 'chataigne')
     OR length(r->>'product_key') NOT BETWEEN 1 AND 160 OR length(r->>'product_label') NOT BETWEEN 1 AND 300
     OR (r->>'price') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$') THEN RAISE EXCEPTION 'Prix ou produit invalide'; END IF;
  INSERT INTO public.channel_restaurant_prices (chain_id, restaurant_id, channel, product_key, product_label, price, source)
  SELECT p_chain_id, (r->>'restaurant_id')::uuid, r->>'channel', r->>'product_key', r->>'product_label', (r->>'price')::numeric, 'import'
  FROM jsonb_array_elements(p_rows) r
  JOIN public.restaurants rs ON rs.id = (r->>'restaurant_id')::uuid AND rs.chain_id = p_chain_id
  ON CONFLICT (restaurant_id, channel, product_key) DO UPDATE SET price = EXCLUDED.price, product_label = EXCLUDED.product_label, source = 'import', updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.get_channel_price_matrix(uuid), public.set_channel_restaurant_price(uuid,text,text,text,numeric), public.import_channel_restaurant_prices(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_channel_price_matrix(uuid), public.set_channel_restaurant_price(uuid,text,text,text,numeric), public.import_channel_restaurant_prices(uuid,jsonb) TO authenticated;