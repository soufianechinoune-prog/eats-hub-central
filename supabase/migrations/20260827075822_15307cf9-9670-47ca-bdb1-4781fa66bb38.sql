ALTER TABLE public.instore_price_grid ADD COLUMN IF NOT EXISTS chain_id uuid;
UPDATE public.instore_price_grid SET chain_id='110e05b8-5136-45cc-a385-265360104844' WHERE chain_id IS NULL;
ALTER TABLE public.instore_price_grid ALTER COLUMN chain_id SET NOT NULL;
ALTER TABLE public.instore_price_grid ADD CONSTRAINT instore_price_grid_chain_fk FOREIGN KEY (chain_id) REFERENCES public.chains(id) ON DELETE CASCADE;
ALTER TABLE public.instore_price_grid DROP CONSTRAINT IF EXISTS chataigne_instore_price_version_product_key_key;
ALTER TABLE public.instore_price_grid ADD CONSTRAINT instore_price_grid_chain_version_product_key UNIQUE (chain_id, version, product_key);
ALTER TABLE public.instore_price_grid ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instore_price_grid_select ON public.instore_price_grid;
CREATE POLICY instore_price_grid_select ON public.instore_price_grid FOR SELECT TO authenticated USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));

DROP FUNCTION IF EXISTS public.get_instore_price_grid();
CREATE OR REPLACE FUNCTION public.get_instore_price_grid(p_chain_id uuid)
 RETURNS TABLE(version text, product_label text, product_key text, price numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.user_has_chain_access(p_chain_id)) THEN
    RAISE EXCEPTION 'Access denied for chain %', p_chain_id;
  END IF;
  RETURN QUERY
    SELECT g.version, g.product_label, g.product_key, g.price
    FROM public.instore_price_grid g
    WHERE g.chain_id = p_chain_id
    ORDER BY g.product_label, g.version;
END; $$;

DROP FUNCTION IF EXISTS public.set_instore_grid_price(text, text, numeric);
CREATE OR REPLACE FUNCTION public.set_instore_grid_price(p_chain_id uuid, p_version text, p_product_key text, p_price numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.instore_price_grid SET price=p_price
   WHERE chain_id=p_chain_id AND version=p_version AND product_key=p_product_key;
END; $$;

DROP FUNCTION IF EXISTS public.get_restaurant_price_versions();
CREATE OR REPLACE FUNCTION public.get_restaurant_price_versions(p_chain_id uuid)
 RETURNS TABLE(version text, restaurant_id uuid, restaurant_name text, city text, method text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT v.version, v.restaurant_id, r.name, r.city, v.method
  FROM public.restaurant_price_version v JOIN public.restaurants r ON r.id=v.restaurant_id
  WHERE r.chain_id = p_chain_id
    AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
  ORDER BY v.version, r.name;
$$;

REVOKE ALL ON FUNCTION public.get_instore_price_grid(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_instore_price_grid(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.set_instore_grid_price(uuid, text, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_instore_grid_price(uuid, text, text, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.get_restaurant_price_versions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_price_versions(uuid) TO authenticated;