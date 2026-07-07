
-- Extend weekly_reports with token + csv + whatsapp tracking
ALTER TABLE public.weekly_reports
  ADD COLUMN IF NOT EXISTS download_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS csv_path text,
  ADD COLUMN IF NOT EXISTS sent_via_whatsapp boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_batch_id text,
  ADD COLUMN IF NOT EXISTS sent_phones text[];

CREATE INDEX IF NOT EXISTS idx_weekly_reports_token ON public.weekly_reports(download_token) WHERE download_token IS NOT NULL;

-- Extend weekly_report_recipients: allow either email or phone
ALTER TABLE public.weekly_report_recipients
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';

ALTER TABLE public.weekly_report_recipients ALTER COLUMN email DROP NOT NULL;

-- Cron: every Thursday 07:00 UTC (=08:00 Paris in winter, 09:00 in summer — acceptable)
-- Only for chains with active whatsapp recipients
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('weekly-uber-report-whatsapp');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'weekly-uber-report-whatsapp',
  '0 7 * * 4',
  $$
  SELECT net.http_post(
    url := 'https://akcicojkrzeirffefdet.supabase.co/functions/v1/send-weekly-report-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object('chainId', c.id::text)
  )
  FROM public.chains c
  WHERE EXISTS (
    SELECT 1 FROM public.weekly_report_recipients r
    WHERE r.chain_id = c.id AND r.active = true AND r.channel = 'whatsapp' AND r.phone IS NOT NULL
  );
  $$
);
