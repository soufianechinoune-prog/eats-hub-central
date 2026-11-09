COMMENT ON COLUMN public.uber_direct_deliveries.basket_value_cents IS 'manifest.total_value : montant TTC total payé par le client, remises déduites, FRAIS DE LIVRAISON ET DE SERVICE INCLUS (constaté 488/488 = chataigne_orders.total_amount, semaine du 02/11/2026).';
COMMENT ON COLUMN public.uber_direct_deliveries.discount_cents IS 'max(0, somme prix×qté de TOUTES les lignes manifest_items (frais inclus) − manifest.total_value). Non ventilée produits/frais.';
COMMENT ON COLUMN public.uber_direct_deliveries.client_delivery_fee_cents IS 'Ligne manifeste "Frais de livraison" (prix affiché, AVANT remise éventuelle : une livraison offerte peut apparaître en remise).';
SELECT cron.schedule('uber-direct-sync-daily', '30 4 * * *', $$
  SELECT net.http_post(
    url := 'https://akcicojkrzeirffefdet.supabase.co/functions/v1/uber-direct-sync',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrY2ljb2prcnplaXJmZmVmZGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTQwMzYsImV4cCI6MjA3NzQzMDAzNn0.B_h-NT5QOxszUT0bs4nhxuo5qix2RYF-iMk6lZC3Nw0"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  );
$$);