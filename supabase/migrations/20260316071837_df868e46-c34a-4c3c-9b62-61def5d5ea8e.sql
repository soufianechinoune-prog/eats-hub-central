CREATE TABLE public.eco_line_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  line_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_lines integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eco_line_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on eco_line_snapshots"
  ON public.eco_line_snapshots
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);