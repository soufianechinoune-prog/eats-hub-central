CREATE TABLE public.splash_ticket_raw (
  ticket_uuid uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  ticket_date date NOT NULL,
  payload jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX splash_ticket_raw_date ON public.splash_ticket_raw (ticket_date);
CREATE INDEX splash_ticket_raw_restaurant ON public.splash_ticket_raw (restaurant_id, ticket_date);

GRANT ALL ON public.splash_ticket_raw TO service_role;
REVOKE ALL ON public.splash_ticket_raw FROM anon;

ALTER TABLE public.splash_ticket_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "splash_ticket_raw_service_only" ON public.splash_ticket_raw
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.splash_ticket_raw (ticket_uuid, restaurant_id, chain_id, ticket_date, payload)
SELECT s.id, s.restaurant_id, s.chain_id, s.ticket_date, coalesce(s.raw_payload, s.raw)
  FROM public.splash_tickets s
 WHERE coalesce(s.raw_payload, s.raw) IS NOT NULL
ON CONFLICT (ticket_uuid) DO UPDATE SET payload = excluded.payload, updated_at = now();