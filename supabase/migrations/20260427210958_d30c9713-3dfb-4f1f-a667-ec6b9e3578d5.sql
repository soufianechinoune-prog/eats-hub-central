-- 1. Add multi-store support to uber_connections
ALTER TABLE public.uber_connections
  ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_label TEXT;

-- 2. Drop the unique constraint on restaurant_id (was 1:1, now we want master rows + per-resto rows)
ALTER TABLE public.uber_connections
  DROP CONSTRAINT IF EXISTS uber_connections_restaurant_id_key;

-- 3. Update RLS so master rows (restaurant_id IS NULL) are accessible to super_admin or importer
DROP POLICY IF EXISTS "Chain scoped access on uber_connections" ON public.uber_connections;

CREATE POLICY "Chain scoped access on uber_connections"
ON public.uber_connections
FOR ALL
TO authenticated
USING (
  is_super_admin()
  OR (restaurant_id IS NULL AND get_user_role() IN ('super_admin', 'importer'))
  OR (restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE user_has_chain_access(r.chain_id)))
)
WITH CHECK (
  is_super_admin()
  OR (restaurant_id IS NULL AND get_user_role() IN ('super_admin', 'importer'))
  OR (restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE user_has_chain_access(r.chain_id)))
);

-- 4. Create uber_connection_stores: liaison between a master connection and individual restaurants
CREATE TABLE IF NOT EXISTS public.uber_connection_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.uber_connections(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  uber_store_id TEXT NOT NULL,
  store_name TEXT,
  store_address TEXT,
  activated_at TIMESTAMP WITH TIME ZONE,
  pos_activation_status TEXT NOT NULL DEFAULT 'pending',
  pos_activation_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uber_connection_stores_uber_store_unique UNIQUE (uber_store_id),
  CONSTRAINT uber_connection_stores_restaurant_unique UNIQUE (restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_ucs_connection_id ON public.uber_connection_stores(connection_id);
CREATE INDEX IF NOT EXISTS idx_ucs_restaurant_id ON public.uber_connection_stores(restaurant_id);

ALTER TABLE public.uber_connection_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chain scoped access on uber_connection_stores"
ON public.uber_connection_stores
FOR ALL
TO authenticated
USING (
  is_super_admin()
  OR (restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE user_has_chain_access(r.chain_id)))
)
WITH CHECK (
  is_super_admin()
  OR (restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE user_has_chain_access(r.chain_id)))
);

-- 5. Trigger to keep updated_at fresh
CREATE TRIGGER trg_ucs_updated_at
BEFORE UPDATE ON public.uber_connection_stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();