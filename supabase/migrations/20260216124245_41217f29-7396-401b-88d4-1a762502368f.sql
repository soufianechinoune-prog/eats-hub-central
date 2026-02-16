-- Step 1: Reclassify marketing adjustments that were incorrectly tagged as eco_contribution
UPDATE payout_adjustments 
SET category = 'marketing_adjustment'
WHERE category = 'eco_contribution'
  AND raw_columns->>'Ajustement marketing (TVA incluse)' IS NOT NULL
  AND raw_columns->>'Ajustement marketing (TVA incluse)' != '0'
  AND raw_columns->>'Ajustement marketing (TVA incluse)' != ''
  AND raw_columns->>'Ajustement marketing (TVA incluse)' != '0,00';

-- Step 2: Recalculate eco_contribution_refund and eco_contribution_charge on payouts
-- by re-aggregating only the true eco_contribution lines
WITH eco_totals AS (
  SELECT 
    pa.payout_reference_id,
    COALESCE(SUM(CASE WHEN pa.amount > 0 THEN pa.amount ELSE 0 END), 0) AS refund,
    COALESCE(SUM(CASE WHEN pa.amount < 0 THEN ABS(pa.amount) ELSE 0 END), 0) AS charge
  FROM payout_adjustments pa
  WHERE pa.category = 'eco_contribution'
  GROUP BY pa.payout_reference_id
)
UPDATE payouts p
SET 
  eco_contribution_refund = COALESCE(et.refund, 0),
  eco_contribution_charge = COALESCE(et.charge, 0)
FROM (
  SELECT DISTINCT payout_reference_id 
  FROM payout_adjustments 
  WHERE category = 'marketing_adjustment'
) affected
LEFT JOIN eco_totals et ON et.payout_reference_id = affected.payout_reference_id
WHERE p.payout_reference_id = affected.payout_reference_id;