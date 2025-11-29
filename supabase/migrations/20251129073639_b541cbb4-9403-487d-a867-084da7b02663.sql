-- Ajouter les nouveaux champs à la table restaurants
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS siren text,
ADD COLUMN IF NOT EXISTS manager_first_name text,
ADD COLUMN IF NOT EXISTS manager_last_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS tablet_email text,
ADD COLUMN IF NOT EXISTS tablet_password text,
ADD COLUMN IF NOT EXISTS account_manager_name text,
ADD COLUMN IF NOT EXISTS account_manager_title text,
ADD COLUMN IF NOT EXISTS account_manager_phone text,
ADD COLUMN IF NOT EXISTS account_manager_email text;