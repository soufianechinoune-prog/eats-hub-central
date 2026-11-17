ALTER TABLE public.payout_adjustment_lines ADD COLUMN IF NOT EXISTS order_date_key text;
COMMENT ON COLUMN public.payout_adjustment_lines.order_date_key IS 'Order date normalised across Uber short/descriptive header sets; used only for cross-report duplicate detection.';
UPDATE public.payout_adjustment_lines SET order_date_key = nullif(raw_columns->>'Date de la commande','') WHERE order_date_key IS NULL;

CREATE OR REPLACE FUNCTION public.mark_cross_report_payout_duplicates(p_restaurant_ids uuid[], p_payout_refs text[]) RETURNS TABLE(category text, marked integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND current_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN QUERY
 WITH base AS (
  SELECT l.id, l.restaurant_id, l.payout_reference_id, l.category c, round(l.amount,2) amt, coalesce(l.order_date_key,'') dt,
         l.source_report_hash h, l.source_record_index, l.created_at
  FROM payout_adjustment_lines l
  WHERE l.source_duplicate_of IS NULL AND l.payout_reference_id = ANY(p_payout_refs) AND l.restaurant_id = ANY(p_restaurant_ids)),
 rep AS (SELECT b.*, min(b.created_at) OVER (PARTITION BY b.restaurant_id,b.payout_reference_id,b.c,b.amt,b.dt,b.h) first_seen FROM base b),
 ranked AS (SELECT r.*,
   dense_rank() OVER (PARTITION BY r.restaurant_id,r.payout_reference_id,r.c,r.amt,r.dt ORDER BY r.first_seen,r.h) rk,
   row_number() OVER (PARTITION BY r.restaurant_id,r.payout_reference_id,r.c,r.amt,r.dt,r.h ORDER BY r.source_record_index,r.id) occ
  FROM rep r),
 m AS (SELECT d.id dup, c2.id canon, d.c FROM ranked d JOIN ranked c2
   ON c2.restaurant_id=d.restaurant_id AND c2.payout_reference_id=d.payout_reference_id AND c2.c=d.c AND c2.amt=d.amt AND c2.dt=d.dt
  AND c2.rk=1 AND d.rk>1 AND c2.occ=d.occ AND c2.h<>d.h),
 u AS (UPDATE payout_adjustment_lines l SET source_duplicate_of=m.canon FROM m WHERE l.id=m.dup AND l.source_duplicate_of IS NULL RETURNING m.c)
 SELECT u.c, count(*)::int FROM u GROUP BY u.c;
END $f$;
REVOKE ALL ON FUNCTION public.mark_cross_report_payout_duplicates(uuid[],text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_cross_report_payout_duplicates(uuid[],text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.stage_payout_adjustment_lines(p_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_count integer; g record; v_rest uuid[]; v_refs text[];
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid batch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,uber_store_id text,payout_reference_id text,source_line_key text,source_report_hash text,amount numeric,category text) WHERE x.restaurant_id IS NULL OR x.payout_reference_id IS NULL OR x.category IS NULL OR x.amount IS NULL OR x.source_line_key IS NULL OR length(x.source_line_key)<>64 OR x.source_report_hash IS NULL OR NOT EXISTS(SELECT 1 FROM restaurants r WHERE r.id=x.restaurant_id AND r.uber_store_id=x.uber_store_id)) THEN RAISE EXCEPTION 'invalid or inconsistent restaurant source'; END IF;
 FOR g IN SELECT DISTINCT x.restaurant_id,x.payout_reference_id FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,payout_reference_id text) ORDER BY 1,2 LOOP
 PERFORM pg_advisory_xact_lock(hashtextextended(g.restaurant_id::text||':'||g.payout_reference_id,0));
 IF EXISTS(SELECT 1 FROM payout_source_transitions t WHERE t.restaurant_id=g.restaurant_id AND t.payout_reference_id=g.payout_reference_id) AND EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,payout_reference_id text,source_line_key text) WHERE x.restaurant_id=g.restaurant_id AND x.payout_reference_id=g.payout_reference_id AND NOT EXISTS(SELECT 1 FROM payout_adjustment_lines l WHERE l.source_line_key=x.source_line_key)) THEN RAISE EXCEPTION 'switched payout requires renewed reconciliation'; END IF;
 END LOOP;
 INSERT INTO payout_adjustment_lines(restaurant_id,uber_store_id,restaurant_name,payout_reference_id,payout_date,description,category,amount,raw_columns,source_line_key,source_report_hash,source_record_index,order_date_key)
 SELECT x.restaurant_id,x.uber_store_id,x.restaurant_name,x.payout_reference_id,x.payout_date,x.description,x.category,x.amount,x.raw_columns,x.source_line_key,x.source_report_hash,x.source_record_index,
   coalesce(nullif(x.order_date_key,''), nullif(x.raw_columns->>'Date de la commande',''))
 FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,uber_store_id text,restaurant_name text,payout_reference_id text,payout_date date,description text,category text,amount numeric,raw_columns jsonb,source_line_key text,source_report_hash text,source_record_index integer,order_date_key text)
 ON CONFLICT(source_line_key) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 SELECT array_agg(DISTINCT x.restaurant_id), array_agg(DISTINCT x.payout_reference_id) INTO v_rest, v_refs FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,payout_reference_id text);
 PERFORM public.mark_cross_report_payout_duplicates(v_rest, v_refs);
 RETURN v_count;
END $f$;
REVOKE ALL ON FUNCTION public.stage_payout_adjustment_lines(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage_payout_adjustment_lines(jsonb) TO service_role;