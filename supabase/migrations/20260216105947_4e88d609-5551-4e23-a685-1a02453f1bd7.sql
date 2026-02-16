-- Re-categorize existing "Autres frais" rows as eco_contribution
UPDATE payout_adjustments 
SET category = 'eco_contribution' 
WHERE LOWER(description) = 'autres frais' AND category = 'other_fee';