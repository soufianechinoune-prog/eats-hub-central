
CREATE TABLE public.bodacc_dismissed_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  siren text NOT NULL,
  annonce_key text NOT NULL,
  dismissed_by text,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, annonce_key)
);

ALTER TABLE public.bodacc_dismissed_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to bodacc_dismissed_alerts"
  ON public.bodacc_dismissed_alerts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
