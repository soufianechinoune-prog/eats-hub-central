CREATE TABLE public.backfill_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vague TEXT NOT NULL,
  report_type TEXT NOT NULL,
  restaurant_ids UUID[] NOT NULL DEFAULT '{}',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  total INT NOT NULL DEFAULT 0,
  ok INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  results JSONB DEFAULT '[]'::jsonb,
  triggered_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.backfill_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view backfill runs"
ON public.backfill_runs
FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admin can insert backfill runs"
ON public.backfill_runs
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can update backfill runs"
ON public.backfill_runs
FOR UPDATE
TO authenticated
USING (public.is_super_admin());

CREATE INDEX idx_backfill_runs_started_at ON public.backfill_runs(started_at DESC);