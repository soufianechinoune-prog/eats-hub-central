-- ============================================================
-- Backfill historique Uber Eats : table de queue + helpers
-- ============================================================

-- Table de queue
CREATE TABLE IF NOT EXISTS public.backfill_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  restaurant_name TEXT NOT NULL,
  uber_store_id TEXT NOT NULL,
  month_start DATE NOT NULL,
  month_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | failed | skipped
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  report_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, month_start)
);

-- Indexes pour la perf du picker
CREATE INDEX IF NOT EXISTS idx_backfill_jobs_status_created 
  ON public.backfill_jobs (status, created_at) 
  WHERE status IN ('pending','running');

CREATE INDEX IF NOT EXISTS idx_backfill_jobs_restaurant 
  ON public.backfill_jobs (restaurant_id, month_start);

-- RLS : super_admin only
ALTER TABLE public.backfill_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view backfill jobs"
  ON public.backfill_jobs FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admin can insert backfill jobs"
  ON public.backfill_jobs FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update backfill jobs"
  ON public.backfill_jobs FOR UPDATE
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admin can delete backfill jobs"
  ON public.backfill_jobs FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- Trigger updated_at
CREATE TRIGGER trg_backfill_jobs_updated_at
  BEFORE UPDATE ON public.backfill_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Fonction : seed des jobs (idempotente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_backfill_jobs(
  p_start_date DATE,
  p_end_date DATE,
  p_restaurant_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(inserted_count INTEGER, skipped_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can seed backfill jobs';
  END IF;

  WITH months AS (
    SELECT generate_series(
      date_trunc('month', p_start_date)::date,
      date_trunc('month', p_end_date)::date,
      interval '1 month'
    )::date AS m_start
  ),
  candidates AS (
    SELECT 
      r.id AS restaurant_id,
      r.name AS restaurant_name,
      r.uber_store_id,
      m.m_start AS month_start,
      (m.m_start + interval '1 month' - interval '1 day')::date AS month_end
    FROM restaurants r
    CROSS JOIN months m
    WHERE r.uber_store_id IS NOT NULL
      AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids))
  ),
  ins AS (
    INSERT INTO backfill_jobs (restaurant_id, restaurant_name, uber_store_id, month_start, month_end, status)
    SELECT restaurant_id, restaurant_name, uber_store_id, month_start, month_end, 'pending'
    FROM candidates
    ON CONFLICT (restaurant_id, month_start) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_inserted FROM ins;

  v_skipped := (SELECT COUNT(*) FROM (
    SELECT 1 FROM restaurants r 
    CROSS JOIN (SELECT generate_series(
      date_trunc('month', p_start_date)::date,
      date_trunc('month', p_end_date)::date,
      interval '1 month'
    )::date AS m_start) m
    WHERE r.uber_store_id IS NOT NULL
      AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids))
  ) sub) - v_inserted;

  RETURN QUERY SELECT v_inserted, GREATEST(v_skipped, 0);
END;
$$;

-- ============================================================
-- Fonction : pick atomique du prochain job
-- ============================================================
CREATE OR REPLACE FUNCTION public.pick_next_backfill_job()
RETURNS TABLE(
  job_id UUID,
  restaurant_id UUID,
  restaurant_name TEXT,
  uber_store_id TEXT,
  month_start DATE,
  month_end DATE,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next_job AS (
    SELECT id
    FROM backfill_jobs
    WHERE status = 'pending'
    ORDER BY restaurant_name ASC, month_start ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE backfill_jobs bj
  SET status = 'running',
      started_at = now(),
      attempts = bj.attempts + 1,
      updated_at = now()
  FROM next_job
  WHERE bj.id = next_job.id
  RETURNING bj.id, bj.restaurant_id, bj.restaurant_name, bj.uber_store_id, 
           bj.month_start, bj.month_end, bj.attempts;
END;
$$;

-- ============================================================
-- Fonction : reset des jobs bloqués (>30 min en running)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_stale_backfill_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE backfill_jobs
  SET status = CASE 
    WHEN attempts >= 3 THEN 'failed'
    ELSE 'pending'
  END,
  last_error = COALESCE(last_error, '') || ' [auto-reset: stuck in running >30min]',
  updated_at = now()
  WHERE status = 'running'
    AND started_at < now() - interval '30 minutes';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- Vue : statistiques globales pour l'UI
-- ============================================================
CREATE OR REPLACE VIEW public.backfill_jobs_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'running') AS running,
  COUNT(*) FILTER (WHERE status = 'done') AS done,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
  COUNT(*) AS total,
  MIN(started_at) FILTER (WHERE status IN ('done','running')) AS started_at,
  MAX(completed_at) FILTER (WHERE status = 'done') AS last_completed_at
FROM backfill_jobs;

GRANT SELECT ON public.backfill_jobs_stats TO authenticated;