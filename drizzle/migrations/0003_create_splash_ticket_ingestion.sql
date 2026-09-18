-- 1. Credentials per restaurant / station (service_role only)
CREATE TABLE public.splash_restaurant_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  splash_restaurant_id integer,
  station text NOT NULL DEFAULT 'default',
  station_type text,
  splash_name text,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_ok_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX splash_creds_client_id_key ON public.splash_restaurant_credentials (client_id);
CREATE UNIQUE INDEX splash_creds_resto_station_key ON public.splash_restaurant_credentials (restaurant_id, station);
GRANT ALL ON public.splash_restaurant_credentials TO service_role;
ALTER TABLE public.splash_restaurant_credentials ENABLE ROW LEVEL SECURITY;

-- 2. Tickets
CREATE TABLE public.splash_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  station text NOT NULL DEFAULT 'default',
  splash_ticket_id text NOT NULL,
  ticket_datetime timestamptz NOT NULL,
  ticket_date date NOT NULL,
  service_type text,
  payment_label_raw text,
  payment_category text,
  payment_brand text,
  total_amount numeric(12,2),
  discount_amount numeric(12,2),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX splash_tickets_natural_key ON public.splash_tickets (restaurant_id, station, splash_ticket_id);
CREATE INDEX splash_tickets_resto_dt ON public.splash_tickets (restaurant_id, ticket_datetime);
CREATE INDEX splash_tickets_chain_date ON public.splash_tickets (chain_id, ticket_date);
GRANT SELECT ON public.splash_tickets TO authenticated;
GRANT ALL ON public.splash_tickets TO service_role;
ALTER TABLE public.splash_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tickets readable within chain" ON public.splash_tickets
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));

-- 3. Ticket lines
CREATE TABLE public.splash_ticket_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_uuid uuid NOT NULL REFERENCES public.splash_tickets(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  ticket_date date NOT NULL,
  line_key text NOT NULL,
  product_name text,
  product_ref text,
  category text,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2),
  total_price numeric(12,2),
  depth integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX splash_lines_natural_key ON public.splash_ticket_lines (ticket_uuid, line_key);
CREATE INDEX splash_lines_resto_date ON public.splash_ticket_lines (restaurant_id, ticket_date);
CREATE INDEX splash_lines_category ON public.splash_ticket_lines (chain_id, category);
GRANT SELECT ON public.splash_ticket_lines TO authenticated;
GRANT ALL ON public.splash_ticket_lines TO service_role;
ALTER TABLE public.splash_ticket_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ticket lines readable within chain" ON public.splash_ticket_lines
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));

-- 4. Payment label normalisation map
CREATE TABLE public.splash_payment_label_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_label text NOT NULL,
  category text NOT NULL DEFAULT 'Autre',
  brand text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX splash_payment_label_key ON public.splash_payment_label_map (lower(raw_label));
GRANT SELECT ON public.splash_payment_label_map TO authenticated;
GRANT ALL ON public.splash_payment_label_map TO service_role;
ALTER TABLE public.splash_payment_label_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payment map readable" ON public.splash_payment_label_map
  FOR SELECT TO authenticated USING (true);

-- 5. Backfill queue
CREATE TABLE public.splash_ticket_backfill_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  station text NOT NULL DEFAULT 'default',
  year integer NOT NULL,
  month integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 100,
  attempts integer NOT NULL DEFAULT 0,
  page_cursor integer NOT NULL DEFAULT 1,
  tickets_upserted integer NOT NULL DEFAULT 0,
  lines_upserted integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX splash_ticket_jobs_key ON public.splash_ticket_backfill_jobs (restaurant_id, station, year, month);
CREATE INDEX splash_ticket_jobs_queue ON public.splash_ticket_backfill_jobs (status, priority, next_attempt_at);
GRANT SELECT ON public.splash_ticket_backfill_jobs TO authenticated;
GRANT ALL ON public.splash_ticket_backfill_jobs TO service_role;
ALTER TABLE public.splash_ticket_backfill_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ticket jobs readable within chain" ON public.splash_ticket_backfill_jobs
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));

-- 6. Brand consistency guards
CREATE OR REPLACE FUNCTION public.enforce_splash_ticket_chain_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r_chain uuid;
BEGIN
  SELECT chain_id INTO r_chain FROM public.restaurants WHERE id = NEW.restaurant_id;
  IF r_chain IS NULL THEN
    RAISE EXCEPTION 'Restaurant % introuvable', NEW.restaurant_id;
  END IF;
  IF NEW.chain_id IS DISTINCT FROM r_chain THEN
    RAISE EXCEPTION 'chain_id % ne correspond pas au restaurant % (%).', NEW.chain_id, NEW.restaurant_id, r_chain;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER splash_creds_chain_check BEFORE INSERT OR UPDATE ON public.splash_restaurant_credentials
  FOR EACH ROW EXECUTE FUNCTION public.enforce_splash_ticket_chain_consistency();
CREATE TRIGGER splash_tickets_chain_check BEFORE INSERT OR UPDATE ON public.splash_tickets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_splash_ticket_chain_consistency();
CREATE TRIGGER splash_lines_chain_check BEFORE INSERT OR UPDATE ON public.splash_ticket_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_splash_ticket_chain_consistency();
CREATE TRIGGER splash_ticket_jobs_chain_check BEFORE INSERT OR UPDATE ON public.splash_ticket_backfill_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_splash_ticket_chain_consistency();

-- 7. Coverage view (anti double-counting indicator)
CREATE OR REPLACE VIEW public.splash_ticket_coverage AS
SELECT restaurant_id, chain_id, date_trunc('month', ticket_date)::date AS month,
       count(*) AS ticket_count, sum(total_amount) AS ticket_revenue
FROM public.splash_tickets
GROUP BY 1,2,3;
GRANT SELECT ON public.splash_ticket_coverage TO authenticated;
GRANT SELECT ON public.splash_ticket_coverage TO service_role;