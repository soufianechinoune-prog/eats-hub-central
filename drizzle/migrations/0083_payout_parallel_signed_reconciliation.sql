ALTER TABLE public.payout_adjustments ADD COLUMN transition_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.payout_adjustments ADD COLUMN superseded_at timestamptz;
CREATE TABLE public.payout_adjustment_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL, uber_store_id text NOT NULL, restaurant_name text,
 payout_reference_id text NOT NULL, payout_date date, description text, category text NOT NULL, amount numeric NOT NULL,
 raw_columns jsonb NOT NULL DEFAULT '{}', source_line_key text NOT NULL UNIQUE, source_report_hash text NOT NULL,
 source_record_index integer, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payout_adjustment_lines TO authenticated;
GRANT ALL ON public.payout_adjustment_lines TO service_role;
ALTER TABLE public.payout_adjustment_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoped raw payout lines" ON public.payout_adjustment_lines FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.restaurants r WHERE r.id=restaurant_id AND public.user_has_chain_access(r.chain_id)));
CREATE INDEX payout_raw_restaurant_ref ON public.payout_adjustment_lines(restaurant_id,payout_reference_id);
CREATE TABLE public.payout_source_transitions (
 restaurant_id uuid NOT NULL, payout_reference_id text NOT NULL, evidence text NOT NULL, switched_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(restaurant_id,payout_reference_id)
);
GRANT SELECT ON public.payout_source_transitions TO authenticated;
GRANT ALL ON public.payout_source_transitions TO service_role;
ALTER TABLE public.payout_source_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoped payout transitions" ON public.payout_source_transitions FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.restaurants r WHERE r.id=restaurant_id AND public.user_has_chain_access(r.chain_id)));
CREATE VIEW public.payout_adjustments_effective WITH (security_invoker=true) AS
 SELECT a.id,a.restaurant_id,a.uber_store_id,a.restaurant_name,a.payout_reference_id,a.payout_date,a.description,a.category,a.amount,a.raw_columns,a.source_line_key,a.source_report_hash,a.source_record_index,a.created_at,'legacy'::text AS source_kind
 FROM public.payout_adjustments a WHERE NOT EXISTS(SELECT 1 FROM public.payout_source_transitions t WHERE t.restaurant_id=a.restaurant_id AND t.payout_reference_id=a.payout_reference_id)
 UNION ALL
 SELECT a.id,a.restaurant_id,a.uber_store_id,a.restaurant_name,a.payout_reference_id,a.payout_date,a.description,a.category,a.amount,a.raw_columns,a.source_line_key,a.source_report_hash,a.source_record_index,a.created_at,'raw'::text
 FROM public.payout_adjustment_lines a WHERE EXISTS(SELECT 1 FROM public.payout_source_transitions t WHERE t.restaurant_id=a.restaurant_id AND t.payout_reference_id=a.payout_reference_id);
GRANT SELECT ON public.payout_adjustments_effective TO authenticated,service_role;
CREATE VIEW public.payout_signed_reconciliation WITH (security_invoker=true) AS
 WITH old AS (SELECT restaurant_id,payout_reference_id,coalesce(description,'') description,category,sign(amount) direction,sum(round(amount,2)) amount,count(*) line_count FROM public.payout_adjustments GROUP BY 1,2,3,4,5),
 raw AS (SELECT restaurant_id,payout_reference_id,coalesce(description,'') description,category,sign(amount) direction,sum(round(amount,2)) amount,count(*) line_count FROM public.payout_adjustment_lines GROUP BY 1,2,3,4,5)
 SELECT coalesce(o.restaurant_id,n.restaurant_id) restaurant_id,coalesce(o.payout_reference_id,n.payout_reference_id) payout_reference_id,coalesce(o.description,n.description) description,coalesce(o.category,n.category) category,coalesce(o.direction,n.direction) direction,
 o.amount old_amount,n.amount new_amount,coalesce(n.amount,0)-coalesce(o.amount,0) delta,coalesce(o.line_count,0) old_lines,coalesce(n.line_count,0) new_lines,
 CASE WHEN o.line_count IS NULL THEN 'missing_legacy' WHEN n.line_count IS NULL THEN 'missing_api' WHEN o.amount=n.amount THEN 'concordant' ELSE 'amount_difference' END cause
 FROM old o FULL OUTER JOIN raw n ON o.restaurant_id=n.restaurant_id AND o.payout_reference_id=n.payout_reference_id AND o.description=n.description AND o.category=n.category AND o.direction=n.direction;
GRANT SELECT ON public.payout_signed_reconciliation TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.stage_payout_adjustment_lines(p_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_count integer; g record;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid batch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,uber_store_id text,payout_reference_id text,source_line_key text,source_report_hash text,amount numeric,category text) WHERE x.restaurant_id IS NULL OR x.payout_reference_id IS NULL OR x.category IS NULL OR x.amount IS NULL OR x.source_line_key IS NULL OR length(x.source_line_key)<>64 OR x.source_report_hash IS NULL OR NOT EXISTS(SELECT 1 FROM restaurants r WHERE r.id=x.restaurant_id AND r.uber_store_id=x.uber_store_id)) THEN RAISE EXCEPTION 'invalid or inconsistent restaurant source'; END IF;
 FOR g IN SELECT DISTINCT x.restaurant_id,x.payout_reference_id FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,payout_reference_id text) ORDER BY 1,2 LOOP
 PERFORM pg_advisory_xact_lock(hashtextextended(g.restaurant_id::text||':'||g.payout_reference_id,0));
 IF EXISTS(SELECT 1 FROM payout_source_transitions t WHERE t.restaurant_id=g.restaurant_id AND t.payout_reference_id=g.payout_reference_id) AND EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,payout_reference_id text,source_line_key text) WHERE x.restaurant_id=g.restaurant_id AND x.payout_reference_id=g.payout_reference_id AND NOT EXISTS(SELECT 1 FROM payout_adjustment_lines l WHERE l.source_line_key=x.source_line_key)) THEN RAISE EXCEPTION 'switched payout requires renewed reconciliation'; END IF;
 END LOOP;
 INSERT INTO payout_adjustment_lines(restaurant_id,uber_store_id,restaurant_name,payout_reference_id,payout_date,description,category,amount,raw_columns,source_line_key,source_report_hash,source_record_index)
 SELECT x.restaurant_id,x.uber_store_id,x.restaurant_name,x.payout_reference_id,x.payout_date,x.description,x.category,x.amount,x.raw_columns,x.source_line_key,x.source_report_hash,x.source_record_index FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,uber_store_id text,restaurant_name text,payout_reference_id text,payout_date date,description text,category text,amount numeric,raw_columns jsonb,source_line_key text,source_report_hash text,source_record_index integer)
 ON CONFLICT(source_line_key) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count;
END $f$;
REVOKE ALL ON FUNCTION public.stage_payout_adjustment_lines(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_payout_adjustment_lines(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.promote_concordant_payout(p_restaurant_id uuid,p_payout_reference_id text,p_evidence text,p_source_complete boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_source_complete IS DISTINCT FROM true OR p_evidence IS NULL OR length(trim(p_evidence))<10 THEN RAISE EXCEPTION 'complete source evidence required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text||':'||p_payout_reference_id,0));
 IF NOT EXISTS(SELECT 1 FROM payout_adjustment_lines WHERE restaurant_id=p_restaurant_id AND payout_reference_id=p_payout_reference_id) OR EXISTS(SELECT 1 FROM payout_signed_reconciliation WHERE restaurant_id=p_restaurant_id AND payout_reference_id=p_payout_reference_id AND cause<>'concordant') THEN RAISE EXCEPTION 'non_concordant_payout'; END IF;
 UPDATE payout_adjustments SET transition_status='superseded',superseded_at=now() WHERE restaurant_id=p_restaurant_id AND payout_reference_id=p_payout_reference_id;
 INSERT INTO payout_source_transitions(restaurant_id,payout_reference_id,evidence) VALUES(p_restaurant_id,p_payout_reference_id,p_evidence) ON CONFLICT DO NOTHING;
END $f$;
REVOKE ALL ON FUNCTION public.promote_concordant_payout(uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.promote_concordant_payout(uuid,text,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.import_payout_adjustment_lines(p_rows jsonb) RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=public AS $f$ SELECT public.stage_payout_adjustment_lines(p_rows) $f$;
REVOKE ALL ON FUNCTION public.import_payout_adjustment_lines(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.import_payout_adjustment_lines(jsonb) TO service_role;
COMMENT ON FUNCTION public.import_payout_adjustment_lines(jsonb) IS 'Stages immutable parallel source lines only. No legacy deletion or automatic promotion.';