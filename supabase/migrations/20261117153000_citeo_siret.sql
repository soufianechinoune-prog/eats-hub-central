-- SIRET de la société, lu dans le contrat CITEO : sert à relier la société à son restaurant.
ALTER TABLE public.citeo_accounts ADD COLUMN IF NOT EXISTS siret text;
