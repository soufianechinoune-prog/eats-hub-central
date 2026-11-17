-- Read-only regression checks for the user-approved 2026 Rennes reassignment.
-- Run through the managed database read tool; each rule must return true.
SELECT 'audit contains all 11578 approved source rows' AS rule,
       count(*) = 11578 AS passed
FROM public.restaurant_uber_reassignment_audit
WHERE batch_id = '7231a2e7-88f2-4a19-9b12-28f63db50368'
UNION ALL
SELECT 'Villejean keeps 5081 orders and 87971.15 EUR TTC',
       count(*) = 5081 AND sum(round(sales_incl_vat * 100)) = 8797115
FROM public.orders WHERE restaurant_id = 'a7c4d67f-cbba-417b-ad4c-97e7d46a7287'
UNION ALL
SELECT 'Colombier has 3980 orders and 67089.75 EUR TTC',
       count(*) = 3980 AND sum(round(sales_incl_vat * 100)) = 6708975
FROM public.orders WHERE restaurant_id = '599ca4a2-7bd4-4dbb-a01a-667a0e876722'
UNION ALL
SELECT 'Villejean eco debit 346.78 EUR',
       sum(-round(amount * 100)) = 34678
FROM public.payout_adjustments
WHERE restaurant_id = 'a7c4d67f-cbba-417b-ad4c-97e7d46a7287' AND category = 'eco_contribution' AND amount < 0
UNION ALL
SELECT 'Villejean eco refund 400 EUR', sum(round(amount * 100)) = 40000
FROM public.payout_adjustments
WHERE restaurant_id = 'a7c4d67f-cbba-417b-ad4c-97e7d46a7287' AND category = 'eco_contribution' AND amount > 0
UNION ALL
SELECT 'Colombier eco debit 580.34 EUR', sum(-round(amount * 100)) = 58034
FROM public.payout_adjustments
WHERE restaurant_id = '599ca4a2-7bd4-4dbb-a01a-667a0e876722' AND category = 'eco_contribution' AND amount < 0
UNION ALL
SELECT 'All 480 excluded order errors remain on Villejean', count(*) = 480
FROM public.order_errors WHERE restaurant_id = 'a7c4d67f-cbba-417b-ad4c-97e7d46a7287'
UNION ALL
SELECT 'All 1752 excluded availability rows remain on Villejean', count(*) = 1752
FROM public.hourly_availability WHERE restaurant_id = 'a7c4d67f-cbba-417b-ad4c-97e7d46a7287'
UNION ALL
SELECT 'Three unconfirmed histories remain on inactive record', count(*) = 3
FROM public.order_history WHERE restaurant_id = 'bcb90698-903e-4b1c-b80e-bf989a23adb6'
UNION ALL
SELECT 'Inactive restaurant has not been deleted or reactivated', count(*) = 1
FROM public.restaurants WHERE id = 'bcb90698-903e-4b1c-b80e-bf989a23adb6' AND NOT is_active;