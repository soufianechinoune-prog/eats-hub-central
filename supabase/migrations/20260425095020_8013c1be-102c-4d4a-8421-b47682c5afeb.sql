-- 1. Catalogue des connecteurs POS (géré par super-admin uniquement)
CREATE TABLE public.pos_connectors (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  logo_url text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'coming_soon', 'deprecated')),
  auth_type text NOT NULL DEFAULT 'credentials' CHECK (auth_type IN ('credentials', 'api_key', 'oauth2')),
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  website_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_connectors ENABLE ROW LEVEL SECURITY;

-- Tout le monde authentifié peut lire le catalogue
CREATE POLICY "Authenticated read pos_connectors"
ON public.pos_connectors FOR SELECT
TO authenticated
USING (true);

-- Seul super-admin peut écrire/modifier le catalogue
CREATE POLICY "Super admin manage pos_connectors"
ON public.pos_connectors FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE TRIGGER update_pos_connectors_updated_at
BEFORE UPDATE ON public.pos_connectors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Connexion d'une chaîne à un connecteur POS
CREATE TABLE public.chain_pos_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  connector_id text NOT NULL REFERENCES public.pos_connectors(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  account_label text,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_by uuid,
  connected_at timestamp with time zone NOT NULL DEFAULT now(),
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Une seule connexion ACTIVE par chaîne
CREATE UNIQUE INDEX idx_chain_pos_one_active
ON public.chain_pos_connections(chain_id)
WHERE is_active = true;

CREATE INDEX idx_chain_pos_chain ON public.chain_pos_connections(chain_id);
CREATE INDEX idx_chain_pos_connector ON public.chain_pos_connections(connector_id);

ALTER TABLE public.chain_pos_connections ENABLE ROW LEVEL SECURITY;

-- Lecture : super-admin OU membre de la chaîne
CREATE POLICY "Read chain_pos_connections"
ON public.chain_pos_connections FOR SELECT
TO authenticated
USING (is_super_admin() OR user_has_chain_access(chain_id));

-- Insert/Update/Delete : super-admin OU membre de la chaîne (gérant)
CREATE POLICY "Insert chain_pos_connections"
ON public.chain_pos_connections FOR INSERT
TO authenticated
WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));

CREATE POLICY "Update chain_pos_connections"
ON public.chain_pos_connections FOR UPDATE
TO authenticated
USING (is_super_admin() OR user_has_chain_access(chain_id))
WITH CHECK (is_super_admin() OR user_has_chain_access(chain_id));

CREATE POLICY "Delete chain_pos_connections"
ON public.chain_pos_connections FOR DELETE
TO authenticated
USING (is_super_admin() OR user_has_chain_access(chain_id));

CREATE TRIGGER update_chain_pos_connections_updated_at
BEFORE UPDATE ON public.chain_pos_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed du catalogue : Splash360 (actif) + Zelty (bientôt)
INSERT INTO public.pos_connectors (id, name, description, status, auth_type, required_fields, display_order, website_url) VALUES
('splash360', 'Splash360', 'Logiciel de caisse connectée pour la restauration rapide et livraison.', 'available', 'credentials',
 '[
   {"key":"account_id","label":"Identifiant compte Splash360","type":"text","required":true},
   {"key":"username","label":"Email / Utilisateur","type":"email","required":true},
   {"key":"password","label":"Mot de passe","type":"password","required":true}
 ]'::jsonb, 1, 'https://splash360.fr'),
('zelty', 'Zelty', 'Solution de caisse iPad spécialisée restauration. Intégration en cours de développement.', 'coming_soon', 'api_key',
 '[
   {"key":"merchant_id","label":"Identifiant marchand Zelty","type":"text","required":true},
   {"key":"api_key","label":"Clé API","type":"password","required":true}
 ]'::jsonb, 2, 'https://zelty.fr');

-- 4. Migrer la chaîne existante "Chicken Street" pour qu'elle apparaisse déjà connectée à Splash360
INSERT INTO public.chain_pos_connections (chain_id, connector_id, is_active, account_label, credentials, connected_at)
VALUES (
  '110e05b8-5136-45cc-a385-265360104844',
  'splash360',
  true,
  'Compte Chicken Street (migration)',
  '{}'::jsonb,
  now()
);