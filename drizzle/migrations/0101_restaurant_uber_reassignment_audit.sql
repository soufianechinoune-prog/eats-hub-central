CREATE TABLE public.restaurant_uber_reassignment_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL,
 chain_id uuid NOT NULL,
 source_table text NOT NULL,
 source_row_id uuid NOT NULL,
 before_values jsonb NOT NULL,
 after_values jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(batch_id,source_table,source_row_id)
);
GRANT SELECT, INSERT ON public.restaurant_uber_reassignment_audit TO service_role;
ALTER TABLE public.restaurant_uber_reassignment_audit ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.restaurant_uber_reassignment_audit IS 'Service-only append-only audit of explicitly approved Uber restaurant reassignment; before/after changed fields allow targeted rollback. Derived summaries are regenerated from audited source rows.';