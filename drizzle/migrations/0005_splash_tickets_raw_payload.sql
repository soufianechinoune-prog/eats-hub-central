-- Conservation intégrale de la réponse Splash par ticket (hors données personnelles client),
-- pour permettre des analyses futures sans nouveau rattrapage.
ALTER TABLE public.splash_tickets ADD COLUMN IF NOT EXISTS raw_payload jsonb;

COMMENT ON COLUMN public.splash_tickets.raw_payload IS
  'Réponse brute Splash du ticket, expurgée du bloc client (RGPD). Conservée pour analyses futures.';

-- Reprise des tickets déjà importés (témoin + première vague) : le brut y est déjà expurgé.
UPDATE public.splash_tickets
SET raw_payload = raw - 'client'
WHERE raw_payload IS NULL AND raw IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_splash_tickets_raw_payload
  ON public.splash_tickets USING gin (raw_payload jsonb_path_ops);
