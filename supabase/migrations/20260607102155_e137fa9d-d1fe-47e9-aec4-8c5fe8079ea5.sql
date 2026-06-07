INSERT INTO public.pos_connectors (id, name, description, status, auth_type, required_fields, display_order, website_url, logo_url)
VALUES (
  'dishop',
  'Dishop',
  'Plateforme web/app de commande en ligne (Click & Collect, livraison). Récupère CA, commandes et base clients.',
  'available',
  'credentials',
  '[
    {"key":"client_id","type":"text","label":"Client ID Dishop","required":true},
    {"key":"client_secret","type":"password","label":"Client Secret Dishop","required":true},
    {"key":"company_id","type":"text","label":"Company ID (ex: Chicken Street)","required":true}
  ]'::jsonb,
  3,
  'https://dishop.co',
  null
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  auth_type = EXCLUDED.auth_type,
  required_fields = EXCLUDED.required_fields,
  display_order = EXCLUDED.display_order,
  website_url = EXCLUDED.website_url;