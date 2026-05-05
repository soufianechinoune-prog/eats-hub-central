-- Extensions pour le cron et les appels HTTP côté serveur
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Table de jobs : 1 ligne par (chain, restaurant_splash_id, mois)
CREATE TABLE IF NOT EXISTS public.splash_backfill_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id UUID NOT NULL,
  connection_id UUID NOT NULL,
  restaurant_splash_id INTEGER NOT NULL,
  restaurant_name TEXT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | error
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  rows_upserted INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT splash_backfill_jobs_unique UNIQUE (chain_id, restaurant_splash_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_splash_backfill_status ON public.splash_backfill_jobs (status, chain_id);
CREATE INDEX IF NOT EXISTS idx_splash_backfill_pending ON public.splash_backfill_jobs (chain_id, created_at) WHERE status = 'pending';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_splash_backfill_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_splash_backfill_updated_at ON public.splash_backfill_jobs;
CREATE TRIGGER trg_splash_backfill_updated_at
  BEFORE UPDATE ON public.splash_backfill_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_splash_backfill_updated_at();

-- RLS : super admin uniquement
ALTER TABLE public.splash_backfill_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin select splash_backfill_jobs"
  ON public.splash_backfill_jobs FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admin insert splash_backfill_jobs"
  ON public.splash_backfill_jobs FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin update splash_backfill_jobs"
  ON public.splash_backfill_jobs FOR UPDATE
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admin delete splash_backfill_jobs"
  ON public.splash_backfill_jobs FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- Fonction : retourne la progression d'un backfill pour une marque
CREATE OR REPLACE FUNCTION public.splash_backfill_progress(p_chain_id UUID)
RETURNS TABLE (
  total BIGINT,
  pending BIGINT,
  running BIGINT,
  done BIGINT,
  error BIGINT,
  oldest_pending_created TIMESTAMPTZ,
  latest_completed TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS pending,
    COUNT(*) FILTER (WHERE status = 'running')::BIGINT AS running,
    COUNT(*) FILTER (WHERE status = 'done')::BIGINT AS done,
    COUNT(*) FILTER (WHERE status = 'error')::BIGINT AS error,
    MIN(created_at) FILTER (WHERE status = 'pending') AS oldest_pending_created,
    MAX(completed_at) FILTER (WHERE status = 'done') AS latest_completed
  FROM public.splash_backfill_jobs
  WHERE chain_id = p_chain_id;
$$;