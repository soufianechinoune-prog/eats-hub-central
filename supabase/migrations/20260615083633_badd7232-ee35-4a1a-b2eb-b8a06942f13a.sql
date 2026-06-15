
CREATE OR REPLACE FUNCTION public.splash360_reset_stuck_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.splash360_sync_runs
     SET status = 'failed',
         finished_at = COALESCE(finished_at, now()),
         details = COALESCE(details, '{}'::jsonb) || jsonb_build_object('reset_reason', 'stuck_zombie')
   WHERE status = 'running'
     AND triggered_at < now() - interval '15 minutes';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

SELECT public.splash360_reset_stuck_runs();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='sync-splash360-daily') THEN PERFORM cron.unschedule('sync-splash360-daily'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='splash360-sync-day') THEN PERFORM cron.unschedule('splash360-sync-day'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='splash360-sync-night') THEN PERFORM cron.unschedule('splash360-sync-night'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='splash-sync-live') THEN PERFORM cron.unschedule('splash-sync-live'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='splash-sync-month-catchup') THEN PERFORM cron.unschedule('splash-sync-month-catchup'); END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='splash-reset-stuck-runs') THEN PERFORM cron.unschedule('splash-reset-stuck-runs'); END IF;
END $$;

SELECT cron.schedule(
  'splash-sync-live',
  '*/10 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://akcicojkrzeirffefdet.supabase.co/functions/v1/sync-splash360',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrY2ljb2prcnplaXJmZmVmZGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTQwMzYsImV4cCI6MjA3NzQzMDAzNn0.B_h-NT5QOxszUT0bs4nhxuo5qix2RYF-iMk6lZC3Nw0"}'::jsonb,
    body := '{"sync_all_active":true,"scope":"today","trigger_source":"cron-live"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);

SELECT cron.schedule(
  'splash-sync-month-catchup',
  '0 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://akcicojkrzeirffefdet.supabase.co/functions/v1/sync-splash360',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrY2ljb2prcnplaXJmZmVmZGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTQwMzYsImV4cCI6MjA3NzQzMDAzNn0.B_h-NT5QOxszUT0bs4nhxuo5qix2RYF-iMk6lZC3Nw0"}'::jsonb,
    body := '{"sync_all_active":true,"scope":"month","trigger_source":"cron-catchup"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);

SELECT cron.schedule(
  'splash-reset-stuck-runs',
  '*/5 * * * *',
  $cron$ SELECT public.splash360_reset_stuck_runs(); $cron$
);
