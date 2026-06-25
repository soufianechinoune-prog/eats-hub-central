
-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous version of this cron job
DO $$
BEGIN
  PERFORM cron.unschedule('uber-daily-backfill-trigger');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule daily Uber backfill trigger at 05:00 UTC
SELECT cron.schedule(
  'uber-daily-backfill-trigger',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://akcicojkrzeirffefdet.supabase.co/functions/v1/uber-daily-backfill-trigger',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrY2ljb2prcnplaXJmZmVmZGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTQwMzYsImV4cCI6MjA3NzQzMDAzNn0.B_h-NT5QOxszUT0bs4nhxuo5qix2RYF-iMk6lZC3Nw0"}'::jsonb,
    body := jsonb_build_object('trigger', 'cron', 'time', now())
  );
  $$
);
