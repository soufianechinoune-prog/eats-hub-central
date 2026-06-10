
-- =============================================
-- 1) dishop_shop_mapping
-- =============================================
CREATE TABLE public.dishop_shop_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  chain_connection_id UUID NOT NULL REFERENCES public.chain_pos_connections(id) ON DELETE CASCADE,
  dishop_shop_id TEXT NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  raw_label TEXT,
  matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, dishop_shop_id)
);

CREATE INDEX idx_dishop_shop_mapping_chain ON public.dishop_shop_mapping(chain_id);
CREATE INDEX idx_dishop_shop_mapping_restaurant ON public.dishop_shop_mapping(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dishop_shop_mapping TO authenticated;
GRANT ALL ON public.dishop_shop_mapping TO service_role;

ALTER TABLE public.dishop_shop_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read dishop_shop_mapping" ON public.dishop_shop_mapping
  FOR SELECT TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Insert dishop_shop_mapping" ON public.dishop_shop_mapping
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Update dishop_shop_mapping" ON public.dishop_shop_mapping
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id))
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Delete dishop_shop_mapping" ON public.dishop_shop_mapping
  FOR DELETE TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));

-- =============================================
-- 2) dishop_sync_runs
-- =============================================
CREATE TABLE public.dishop_sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  chain_connection_id UUID NOT NULL REFERENCES public.chain_pos_connections(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week_index INTEGER,
  status TEXT NOT NULL DEFAULT 'running',  -- running | success | failed
  triggered_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  files_meta JSONB,
  rows_inserted JSONB,                      -- { customers: N, orders: N, items: N }
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dishop_sync_runs_chain ON public.dishop_sync_runs(chain_id, started_at DESC);
CREATE INDEX idx_dishop_sync_runs_period ON public.dishop_sync_runs(chain_id, year, month, week_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dishop_sync_runs TO authenticated;
GRANT ALL ON public.dishop_sync_runs TO service_role;

ALTER TABLE public.dishop_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read dishop_sync_runs" ON public.dishop_sync_runs
  FOR SELECT TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Insert dishop_sync_runs" ON public.dishop_sync_runs
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Update dishop_sync_runs" ON public.dishop_sync_runs
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id))
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Delete dishop_sync_runs" ON public.dishop_sync_runs
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- =============================================
-- 3) dishop_customers
-- =============================================
CREATE TABLE public.dishop_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  dishop_customer_id TEXT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  phone_country_code TEXT,
  phone_prefix TEXT,
  first_order_date TIMESTAMPTZ,
  last_order_date TIMESTAMPTZ,
  newsletter BOOLEAN,
  shop_ids TEXT[],
  fidelite_id TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, dishop_customer_id)
);

CREATE INDEX idx_dishop_customers_chain ON public.dishop_customers(chain_id);
CREATE INDEX idx_dishop_customers_email ON public.dishop_customers(chain_id, email);
CREATE INDEX idx_dishop_customers_phone ON public.dishop_customers(chain_id, phone_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dishop_customers TO authenticated;
GRANT ALL ON public.dishop_customers TO service_role;

ALTER TABLE public.dishop_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read dishop_customers" ON public.dishop_customers
  FOR SELECT TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Insert dishop_customers" ON public.dishop_customers
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Update dishop_customers" ON public.dishop_customers
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id))
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Delete dishop_customers" ON public.dishop_customers
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- =============================================
-- 4) dishop_orders
-- =============================================
CREATE TABLE public.dishop_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  chain_connection_id UUID REFERENCES public.chain_pos_connections(id) ON DELETE SET NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  dishop_shop_id TEXT NOT NULL,
  charge_id TEXT NOT NULL,
  order_number INTEGER,
  dishop_customer_id TEXT,
  order_date TIMESTAMPTZ,
  order_type TEXT,                  -- delivery | click_and_collect
  status TEXT,
  payment_type TEXT,
  price_total NUMERIC(10,2),
  commission_dishop_amount NUMERIC(10,2),
  commission_dishop_variable NUMERIC(10,4),
  commission_dishop_fixe NUMERIC(10,4),
  commission_orderType_amount NUMERIC(10,2),
  commission_orderType_name TEXT,
  marketing_promo_used BOOLEAN,
  address JSONB,                    -- { city, postalCode, region, street, lat, lng }
  raw_order JSONB,
  raw_billing JSONB,
  source_year INTEGER,
  source_month INTEGER,
  source_week_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, charge_id)
);

CREATE INDEX idx_dishop_orders_chain_date ON public.dishop_orders(chain_id, order_date DESC);
CREATE INDEX idx_dishop_orders_restaurant_date ON public.dishop_orders(restaurant_id, order_date DESC);
CREATE INDEX idx_dishop_orders_shop ON public.dishop_orders(chain_id, dishop_shop_id);
CREATE INDEX idx_dishop_orders_customer ON public.dishop_orders(chain_id, dishop_customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dishop_orders TO authenticated;
GRANT ALL ON public.dishop_orders TO service_role;

ALTER TABLE public.dishop_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read dishop_orders" ON public.dishop_orders
  FOR SELECT TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Insert dishop_orders" ON public.dishop_orders
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Update dishop_orders" ON public.dishop_orders
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id))
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Delete dishop_orders" ON public.dishop_orders
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- =============================================
-- 5) dishop_order_items
-- =============================================
CREATE TABLE public.dishop_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dishop_order_id UUID NOT NULL REFERENCES public.dishop_orders(id) ON DELETE CASCADE,
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  category_id TEXT,
  category_name TEXT,
  category_position INTEGER,
  product_key TEXT,
  item_key TEXT,
  item_name TEXT,
  section_key TEXT,
  ref TEXT,
  nb INTEGER,
  unit_price NUMERIC(10,2),
  price_ref NUMERIC(10,2),
  value INTEGER,
  position_in_basket INTEGER,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dishop_order_items_order ON public.dishop_order_items(dishop_order_id);
CREATE INDEX idx_dishop_order_items_chain ON public.dishop_order_items(chain_id);
CREATE INDEX idx_dishop_order_items_restaurant ON public.dishop_order_items(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dishop_order_items TO authenticated;
GRANT ALL ON public.dishop_order_items TO service_role;

ALTER TABLE public.dishop_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read dishop_order_items" ON public.dishop_order_items
  FOR SELECT TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Insert dishop_order_items" ON public.dishop_order_items
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Update dishop_order_items" ON public.dishop_order_items
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id))
  WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));
CREATE POLICY "Delete dishop_order_items" ON public.dishop_order_items
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- =============================================
-- 6) Triggers d'isolation cross-brand
-- =============================================

CREATE OR REPLACE FUNCTION public.enforce_dishop_mapping_chain_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resto_chain UUID;
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT chain_id INTO resto_chain FROM public.restaurants WHERE id = NEW.restaurant_id;
  IF resto_chain IS NULL THEN
    RAISE EXCEPTION 'Restaurant % introuvable', NEW.restaurant_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF resto_chain <> NEW.chain_id THEN
    RAISE EXCEPTION
      'Isolation marque violée : shop Dishop "%" (chain=%) ne peut pas être rattaché au restaurant % (chain=%)',
      NEW.dishop_shop_id, NEW.chain_id, NEW.restaurant_id, resto_chain
      USING ERRCODE = 'check_violation',
            HINT = 'Le restaurant doit appartenir à la même marque que la connexion Dishop.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_dishop_mapping_chain
BEFORE INSERT OR UPDATE OF restaurant_id, chain_id ON public.dishop_shop_mapping
FOR EACH ROW EXECUTE FUNCTION public.enforce_dishop_mapping_chain_consistency();

CREATE OR REPLACE FUNCTION public.enforce_dishop_orders_chain_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resto_chain UUID;
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT chain_id INTO resto_chain FROM public.restaurants WHERE id = NEW.restaurant_id;
  IF resto_chain IS NOT NULL AND resto_chain <> NEW.chain_id THEN
    RAISE EXCEPTION
      'Isolation marque violée sur dishop_orders : restaurant % (chain=%) incompatible avec chain_id=%',
      NEW.restaurant_id, resto_chain, NEW.chain_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_dishop_orders_chain
BEFORE INSERT OR UPDATE OF restaurant_id, chain_id ON public.dishop_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_dishop_orders_chain_consistency();

CREATE TRIGGER trg_enforce_dishop_order_items_chain
BEFORE INSERT OR UPDATE OF restaurant_id, chain_id ON public.dishop_order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_dishop_orders_chain_consistency();

-- =============================================
-- 7) Triggers updated_at
-- =============================================
CREATE TRIGGER trg_dishop_shop_mapping_updated_at
BEFORE UPDATE ON public.dishop_shop_mapping
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_dishop_customers_updated_at
BEFORE UPDATE ON public.dishop_customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_dishop_orders_updated_at
BEFORE UPDATE ON public.dishop_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 8) Backfill: quand un shop_mapping est rattaché, propage restaurant_id sur les orders existants
-- =============================================
CREATE OR REPLACE FUNCTION public.dishop_mapping_backfill_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.restaurant_id IS NOT NULL
     AND (OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id) THEN
    UPDATE public.dishop_orders
       SET restaurant_id = NEW.restaurant_id,
           updated_at = now()
     WHERE chain_id = NEW.chain_id
       AND dishop_shop_id = NEW.dishop_shop_id
       AND restaurant_id IS DISTINCT FROM NEW.restaurant_id;

    UPDATE public.dishop_order_items oi
       SET restaurant_id = NEW.restaurant_id
      FROM public.dishop_orders o
     WHERE oi.dishop_order_id = o.id
       AND o.chain_id = NEW.chain_id
       AND o.dishop_shop_id = NEW.dishop_shop_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dishop_mapping_backfill
AFTER UPDATE OF restaurant_id ON public.dishop_shop_mapping
FOR EACH ROW EXECUTE FUNCTION public.dishop_mapping_backfill_orders();
