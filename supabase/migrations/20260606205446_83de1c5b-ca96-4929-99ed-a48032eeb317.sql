
-- Enable scheduling extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Logs table for each sync run
CREATE TABLE IF NOT EXISTS public.splash360_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  trigger_source text NOT NULL DEFAULT 'cron',
  connections_processed integer NOT NULL DEFAULT 0,
  rows_upserted integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.splash360_sync_runs TO authenticated;
GRANT ALL ON public.splash360_sync_runs TO service_role;

ALTER TABLE public.splash360_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view splash360 sync runs"
  ON public.splash360_sync_runs
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_splash360_sync_runs_triggered_at
  ON public.splash360_sync_runs (triggered_at DESC);
