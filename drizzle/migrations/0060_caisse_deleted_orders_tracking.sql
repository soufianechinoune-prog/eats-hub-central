-- Suivi des commandes annulées en caisse AVANT paiement (Splash status=deleted).
-- Table volontairement séparée de caisse_tickets : ces commandes n'ont jamais été encaissées
-- et ne doivent JAMAIS entrer dans le CA. Usage : audit, démarque espèces, taux d'abandon.

CREATE TABLE public.caisse_deleted_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  station text NOT NULL DEFAULT 'default',
  splash_ticket_id text NOT NULL,
  ticket_datetime timestamptz NOT NULL,
  ticket_date date NOT NULL,
  service_type text,
  revenue_center text,
  status text,
  total_amount numeric,
  total_ht numeric,
  total_vat numeric,
  items_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, station, splash_ticket_id, ticket_date)
);

GRANT SELECT ON public.caisse_deleted_orders TO authenticated;
GRANT ALL ON public.caisse_deleted_orders TO service_role;

ALTER TABLE public.caisse_deleted_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY caisse_deleted_orders_read ON public.caisse_deleted_orders
  FOR SELECT TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));

CREATE INDEX idx_caisse_deleted_orders_rest_date ON public.caisse_deleted_orders (restaurant_id, ticket_date);
CREATE INDEX idx_caisse_deleted_orders_chain_date ON public.caisse_deleted_orders (chain_id, ticket_date);

CREATE TRIGGER set_caisse_deleted_orders_updated_at
  BEFORE UPDATE ON public.caisse_deleted_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.caisse_deleted_orders IS 'Commandes Splash annulées en caisse avant paiement (status=deleted). Audit uniquement — jamais dans le CA.';

-- File de rattrapage dédiée (miroir de splash_ticket_backfill_jobs, sans lien avec elle).
CREATE TABLE public.splash_deleted_backfill_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  station text NOT NULL DEFAULT 'default',
  year integer NOT NULL,
  month integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 100,
  attempts integer NOT NULL DEFAULT 0,
  page_cursor integer NOT NULL DEFAULT 0,
  orders_upserted integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, station, year, month)
);

GRANT SELECT ON public.splash_deleted_backfill_jobs TO authenticated;
GRANT ALL ON public.splash_deleted_backfill_jobs TO service_role;

ALTER TABLE public.splash_deleted_backfill_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deleted jobs readable within chain" ON public.splash_deleted_backfill_jobs
  FOR SELECT TO authenticated
  USING (is_super_admin() OR user_has_chain_access(chain_id));

CREATE TRIGGER set_splash_deleted_backfill_jobs_updated_at
  BEFORE UPDATE ON public.splash_deleted_backfill_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.splash_deleted_backfill_jobs IS 'File de rattrapage des commandes annulées Splash (status=deleted). Indépendante du backfill tickets encaissés.';