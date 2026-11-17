-- Suivi CITEO : état de chaque société dans l'espace client CITEO (adhésion, factures à payer).
-- Alimenté par un relevé périodique de l'espace client (lecture seule). Une ligne par société et par enseigne.
-- Le relevé remplace les valeurs à chaque passage ; `checked_at` dit de quand elles datent.

CREATE TABLE IF NOT EXISTS public.citeo_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contract_number text,
  idu text,
  -- Lien manuel vers un restaurant quand l'identifiant unique ne suffit pas à le retrouver.
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  -- adherent | adhesion_en_cours | adhesion_a_valider
  adhesion_status text NOT NULL DEFAULT 'adherent',
  unpaid_count integer NOT NULL DEFAULT 0,
  unpaid_total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  oldest_due_date date,
  -- [{ "label": "Contribution annuelle 2024", "due": "2025-01-31", "ttc": 96 }]
  invoices jsonb NOT NULL DEFAULT '[]'::jsonb,
  einvoicing_missing boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, company_name)
);

CREATE INDEX IF NOT EXISTS citeo_accounts_idu ON public.citeo_accounts (idu);

ALTER TABLE public.citeo_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citeo_accounts_read ON public.citeo_accounts;
CREATE POLICY citeo_accounts_read ON public.citeo_accounts FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
-- Écriture réservée au serveur (relevé) : aucune règle d'écriture pour les utilisateurs.
REVOKE ALL ON public.citeo_accounts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.citeo_accounts FROM authenticated;
