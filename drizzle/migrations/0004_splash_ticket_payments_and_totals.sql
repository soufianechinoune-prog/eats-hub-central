-- Colonnes additionnelles issues du format réel Splash (api/export/orders)
ALTER TABLE public.splash_tickets
  ADD COLUMN IF NOT EXISTS revenue_center TEXT,
  ADD COLUMN IF NOT EXISTS total_ht NUMERIC,
  ADD COLUMN IF NOT EXISTS total_vat NUMERIC,
  ADD COLUMN IF NOT EXISTS status TEXT;

CREATE INDEX IF NOT EXISTS idx_splash_tickets_resto_date
  ON public.splash_tickets (restaurant_id, ticket_date);
CREATE INDEX IF NOT EXISTS idx_splash_tickets_center
  ON public.splash_tickets (revenue_center);

-- Un ticket Splash peut porter plusieurs règlements (reglements[]).
CREATE TABLE IF NOT EXISTS public.splash_ticket_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_uuid UUID NOT NULL REFERENCES public.splash_tickets(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  ticket_date DATE NOT NULL,
  payment_key TEXT NOT NULL,
  raw_label TEXT,
  category TEXT NOT NULL DEFAULT 'Autre',
  brand TEXT,
  amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_uuid, payment_key)
);

CREATE INDEX IF NOT EXISTS idx_splash_ticket_payments_resto_date
  ON public.splash_ticket_payments (restaurant_id, ticket_date);

GRANT SELECT ON public.splash_ticket_payments TO authenticated;
GRANT ALL ON public.splash_ticket_payments TO service_role;

ALTER TABLE public.splash_ticket_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read splash ticket payments"
  ON public.splash_ticket_payments FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));

CREATE TRIGGER enforce_splash_ticket_payments_chain
  BEFORE INSERT OR UPDATE ON public.splash_ticket_payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_splash_ticket_chain_consistency();