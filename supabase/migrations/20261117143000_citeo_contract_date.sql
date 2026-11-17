-- Date de prise d'effet du contrat CITEO (page Contrats de l'espace client).
ALTER TABLE public.citeo_accounts
  ADD COLUMN IF NOT EXISTS contract_effective_date date,
  ADD COLUMN IF NOT EXISTS contract_label text;
