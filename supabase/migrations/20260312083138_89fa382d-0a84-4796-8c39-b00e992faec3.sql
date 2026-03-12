
-- Table to store REP check snapshots for persistence and change tracking
CREATE TABLE public.rep_check_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  restaurant_count integer NOT NULL DEFAULT 0,
  inscrit_count integer NOT NULL DEFAULT 0,
  non_trouve_count integer NOT NULL DEFAULT 0,
  sans_siret_count integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rep_check_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow all operations (matching existing pattern)
CREATE POLICY "Allow all on rep_check_snapshots"
  ON public.rep_check_snapshots
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
