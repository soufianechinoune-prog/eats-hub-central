CREATE TABLE public.eco_observed_rate_windows (
 code text PRIMARY KEY, rate_units integer NOT NULL, valid_from date NOT NULL, valid_to date NOT NULL,
 evidence text NOT NULL DEFAULT 'observed_example_not_certified', vat_basis text NOT NULL DEFAULT 'unknown',
 CHECK(rate_units > 0), CHECK(valid_to >= valid_from)
);
GRANT SELECT ON public.eco_observed_rate_windows TO authenticated;
GRANT ALL ON public.eco_observed_rate_windows TO service_role;
ALTER TABLE public.eco_observed_rate_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read observed candidates" ON public.eco_observed_rate_windows FOR SELECT TO authenticated USING (true);
-- Additive initialization of candidate windows, not certified tariff dates.
INSERT INTO public.eco_observed_rate_windows(code,rate_units,valid_from,valid_to)
SELECT * FROM (VALUES
 ('observed_1130',1130,'2024-01-01'::date,'2026-12-31'::date),
 ('observed_1363',1363,'2025-01-01'::date,'2026-12-31'::date),
 ('observed_1381',1381,'2025-01-01'::date,'2026-12-31'::date),
 ('observed_1829',1829,'2026-01-01'::date,'2026-12-31'::date)
) AS v(code,rate_units,valid_from,valid_to);
CREATE TABLE public.eco_reconciliation_audit (
 adjustment_id uuid PRIMARY KEY REFERENCES public.payout_adjustments(id) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL, chain_id uuid NOT NULL,
 status text NOT NULL, reason text NOT NULL, rate_code text,
 attribution text, candidate_rates jsonb NOT NULL DEFAULT '[]',
 real_volume integer, period_start date, period_end date,
 source_amount numeric NOT NULL, source_line_key text,
 algorithm_version text NOT NULL DEFAULT 'eco_v2', checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.eco_reconciliation_audit TO authenticated;
GRANT ALL ON public.eco_reconciliation_audit TO service_role;
ALTER TABLE public.eco_reconciliation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoped eco audit reads" ON public.eco_reconciliation_audit FOR SELECT TO authenticated USING (public.user_has_chain_access(chain_id));
CREATE OR REPLACE FUNCTION public.get_eco_reconciliation_source(p_restaurant_id uuid)
RETURNS TABLE(id uuid, restaurant_id uuid, chain_id uuid, payout_date date, amount numeric, description text, category text, source_line_key text, volume bigint, period_start date, period_end date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET statement_timeout='30s' AS $f$
DECLARE v_chain uuid;
BEGIN
 SELECT r.chain_id INTO v_chain FROM restaurants r WHERE r.id=p_restaurant_id;
 IF v_chain IS NULL OR (auth.role() IS DISTINCT FROM 'service_role' AND NOT public.user_has_chain_access(v_chain)) THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN QUERY
 WITH adjustments AS (
  SELECT a.* FROM payout_adjustments a WHERE a.restaurant_id=p_restaurant_id
   AND (a.category='eco_contribution' OR a.description ILIKE '%autres frais%' OR a.description ILIKE '%other fees%')
 ), refs AS (SELECT DISTINCT a.payout_reference_id FROM adjustments a),
 volumes AS (
  SELECT o.payout_reference_id,count(DISTINCT o.uber_order_id) n
  FROM orders o JOIN refs f ON f.payout_reference_id=o.payout_reference_id
  WHERE o.restaurant_id=p_restaurant_id GROUP BY o.payout_reference_id
 )
 SELECT a.id,a.restaurant_id,v_chain,a.payout_date,a.amount,a.description,a.category,a.source_line_key, v.n,
 -- Only explicitly verified contribution dates; never manufacture them from the payout date.
 CASE WHEN a.raw_columns->'_mijotek_eco_source_period'->>'verified'='true' THEN (a.raw_columns->'_mijotek_eco_source_period'->>'start')::date END,
 CASE WHEN a.raw_columns->'_mijotek_eco_source_period'->>'verified'='true' THEN (a.raw_columns->'_mijotek_eco_source_period'->>'end')::date END
 FROM adjustments a LEFT JOIN volumes v ON v.payout_reference_id=a.payout_reference_id;
END $f$;
REVOKE ALL ON FUNCTION public.get_eco_reconciliation_source(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_eco_reconciliation_source(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_eco_reconciliation_report(p_chain_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $f$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.user_has_chain_access(p_chain_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN (SELECT jsonb_build_object('chain_id',p_chain_id,'reviewed',count(*),
 'candidate_charged',coalesce(sum(abs(a.source_amount)) FILTER(WHERE a.status='candidate' AND a.source_amount<0),0),
 'candidate_refunded',coalesce(sum(a.source_amount) FILTER(WHERE a.status='candidate' AND a.source_amount>0),0),
 'candidate_restaurants',count(DISTINCT a.restaurant_id) FILTER(WHERE a.status='candidate'),
 'needs_review',count(*) FILTER(WHERE a.status='needs_review'),
 'excluded_under_5',count(*) FILTER(WHERE a.reason='below_5_euros'),
 'unresolved_rate',count(*) FILTER(WHERE a.attribution='to_confirm'),
 'unreviewed',(SELECT count(*) FROM payout_adjustments p JOIN restaurants r ON r.id=p.restaurant_id WHERE r.chain_id=p_chain_id AND (p.category='eco_contribution' OR p.description ILIKE '%autres frais%' OR p.description ILIKE '%other fees%') AND NOT EXISTS(SELECT 1 FROM eco_reconciliation_audit z WHERE z.adjustment_id=p.id)),
 'certified',false)
 FROM eco_reconciliation_audit a WHERE a.chain_id=p_chain_id);
END $f$;
REVOKE ALL ON FUNCTION public.get_eco_reconciliation_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_eco_reconciliation_report(uuid) TO authenticated, service_role;