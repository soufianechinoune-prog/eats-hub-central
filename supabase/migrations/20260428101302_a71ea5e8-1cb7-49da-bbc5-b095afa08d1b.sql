-- Supprimer l'ancien job s'il existe (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-splash360-daily') THEN
    PERFORM cron.unschedule('sync-splash360-daily');
  END IF;
END $$;

-- Créer le job quotidien à 4h UTC
SELECT cron.schedule(
  'sync-splash360-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://akcicojkrzeirffefdet.supabase.co/functions/v1/sync-splash360',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrY2ljb2prcnplaXJmZmVmZGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTQwMzYsImV4cCI6MjA3NzQzMDAzNn0.B_h-NT5QOxszUT0bs4nhxuo5qix2RYF-iMk6lZC3Nw0"}'::jsonb,
    body := '{"sync_all_active": true}'::jsonb
  ) as request_id;
  $$
);