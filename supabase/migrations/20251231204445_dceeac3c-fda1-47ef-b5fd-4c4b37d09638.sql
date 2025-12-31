-- Fix security definer view warning by setting security_invoker
DROP VIEW IF EXISTS public.daily_sales_uber_deduped;

CREATE VIEW public.daily_sales_uber_deduped 
WITH (security_invoker = true) AS
SELECT 
  id,
  restaurant_id,
  date,
  platform,
  revenue_ttc,
  order_count,
  average_basket,
  currency,
  period_type,
  created_at
FROM (
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY restaurant_id, date, platform 
      ORDER BY created_at DESC
    ) AS rn
  FROM public.daily_sales_uber
) sub
WHERE rn = 1;