CREATE OR REPLACE VIEW public.payout_family_reconciliation WITH (security_invoker=true) AS
WITH old AS (SELECT restaurant_id,payout_reference_id,public.payout_reporting_family(description,category) family,sign(amount) direction,sum(round(amount*100)::bigint)::bigint cents,count(*) line_count FROM public.payout_adjustments GROUP BY 1,2,3,4),
raw AS (SELECT restaurant_id,payout_reference_id,public.payout_reporting_family(description,category) family,sign(amount) direction,sum(round(amount*100)::bigint)::bigint cents,count(*) line_count FROM public.payout_adjustment_lines GROUP BY 1,2,3,4)
SELECT coalesce(o.restaurant_id,n.restaurant_id) restaurant_id,coalesce(o.payout_reference_id,n.payout_reference_id) payout_reference_id,coalesce(o.family,n.family) family,coalesce(o.direction,n.direction) direction,o.cents::numeric/100 old_amount,n.cents::numeric/100 new_amount,(coalesce(n.cents,0)-coalesce(o.cents,0))::numeric/100 delta,coalesce(o.line_count,0) old_lines,coalesce(n.line_count,0) new_lines,
CASE WHEN o.line_count IS NULL THEN 'missing_legacy' WHEN n.line_count IS NULL THEN 'missing_api' WHEN o.cents<>n.cents THEN 'amount_difference' ELSE 'concordant' END cause,
o.cents old_cents,n.cents new_cents,coalesce(n.cents,0)-coalesce(o.cents,0) delta_cents
FROM old o FULL OUTER JOIN raw n ON o.restaurant_id=n.restaurant_id AND o.payout_reference_id=n.payout_reference_id AND o.family=n.family AND o.direction=n.direction;
GRANT SELECT ON public.payout_family_reconciliation TO authenticated,service_role;
COMMENT ON VIEW public.payout_family_reconciliation IS 'Signed family diagnostic in integer cents. Only delta_cents=0 with both sources is concordant; one cent remains a discrepancy. Source coverage and detailed promotion gates remain required. Superseded legacy rows are retained.';
DO $$ BEGIN
IF round(10.01::numeric*100)::bigint-round(10.00::numeric*100)::bigint<>1 THEN RAISE EXCEPTION 'one cent regression'; END IF;
IF round(0.10::numeric*100)::bigint+round(0.20::numeric*100)::bigint-round(0.30::numeric*100)::bigint<>0 THEN RAISE EXCEPTION 'split cents regression'; END IF;
END $$;