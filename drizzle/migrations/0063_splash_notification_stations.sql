ALTER TABLE public.splash_webhook_events ADD COLUMN IF NOT EXISTS splash_client_id text;
CREATE INDEX IF NOT EXISTS idx_splash_webhook_events_client ON public.splash_webhook_events(splash_client_id);

CREATE TABLE public.splash_notification_stations (
  client_id text PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL,
  station_credentials_id uuid NOT NULL REFERENCES public.splash_restaurant_credentials(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.splash_notification_stations TO service_role;
ALTER TABLE public.splash_notification_stations ENABLE ROW LEVEL SECURITY;

UPDATE public.splash_webhook_events
SET restaurant_id='c93bc229-1803-4983-8128-2ece417c834f', chain_id='110e05b8-5136-45cc-a385-265360104844',
    station_credentials_id='7b98edfd-685d-4a5d-9efe-03cf694713d7', status='pending'
WHERE id IN ('f558ed62-2fac-4132-991a-6a9614efc768','96b14025-b3b9-4d85-889b-60bb29a3aa88','8757e61c-a918-4b35-af28-68c43db3a698','81e564d5-a20e-4347-8ce3-0f3aa66ce501');