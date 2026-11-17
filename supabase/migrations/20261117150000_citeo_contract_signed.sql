-- Date de signature du contrat CITEO par le cocontractant (page 3 des conditions particulières).
-- Relevée une seule fois par contrat : elle ne change plus ensuite.
ALTER TABLE public.citeo_accounts ADD COLUMN IF NOT EXISTS contract_signed_date date;
