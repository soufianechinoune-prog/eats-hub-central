CREATE TABLE public.restaurant_backfill_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  report_type text NOT NULL DEFAULT 'PAYMENT_DETAILS_REPORT',
  status text NOT NULL DEFAULT 'csv_required',
  note text NOT NULL DEFAULT '',
  flagged_period_start date,
  flagged_period_end date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, report_type)
);

ALTER TABLE public.restaurant_backfill_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin select backfill notes" ON public.restaurant_backfill_notes
  FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super admin insert backfill notes" ON public.restaurant_backfill_notes
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super admin update backfill notes" ON public.restaurant_backfill_notes
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super admin delete backfill notes" ON public.restaurant_backfill_notes
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE TRIGGER trg_restaurant_backfill_notes_updated
  BEFORE UPDATE ON public.restaurant_backfill_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_restaurant_backfill_notes_restaurant ON public.restaurant_backfill_notes(restaurant_id);