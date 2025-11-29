-- Ajouter les colonnes manquantes pour le formulaire de frais
ALTER TABLE public.monthly_fees 
ADD COLUMN IF NOT EXISTS offer_usage_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS order_error NUMERIC DEFAULT 0;

-- Renommer other_fees en eco_contribution pour plus de clarté
ALTER TABLE public.monthly_fees 
RENAME COLUMN other_fees TO eco_contribution;