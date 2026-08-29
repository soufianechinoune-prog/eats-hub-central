CREATE TABLE public.payout_adjustments_snapshot_aug29 (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid,
  restaurant_id uuid,
  uber_store_id text,
  restaurant_name text,
  payout_reference_id text,
  payout_date date,
  description text,
  category text,
  amount numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payout_adjustments_snapshot_aug29 TO authenticated;
GRANT ALL ON public.payout_adjustments_snapshot_aug29 TO service_role;

ALTER TABLE public.payout_adjustments_snapshot_aug29 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read payout snapshot"
ON public.payout_adjustments_snapshot_aug29
FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE INDEX idx_pa_snapshot_key ON public.payout_adjustments_snapshot_aug29 (payout_reference_id, description, uber_store_id);
CREATE INDEX idx_pa_snapshot_date ON public.payout_adjustments_snapshot_aug29 (payout_date);