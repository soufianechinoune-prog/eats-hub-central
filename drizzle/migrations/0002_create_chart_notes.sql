CREATE TABLE public.chart_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  restaurant_ids uuid[] NOT NULL DEFAULT '{}',
  note_date date NOT NULL,
  title text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'amber',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chart_notes_chain_date ON public.chart_notes(chain_id, note_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_notes TO authenticated;
GRANT ALL ON public.chart_notes TO service_role;

ALTER TABLE public.chart_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read notes of their chains"
  ON public.chart_notes FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));

CREATE POLICY "Users can create notes in their chains"
  ON public.chart_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.user_has_chain_access(chain_id));

CREATE POLICY "Users can update notes of their chains"
  ON public.chart_notes FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id))
  WITH CHECK (public.is_super_admin() OR public.user_has_chain_access(chain_id));

CREATE POLICY "Users can delete notes of their chains"
  ON public.chart_notes FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));