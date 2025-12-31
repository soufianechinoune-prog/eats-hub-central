-- Create a deduplicated view for daily_sales_uber
-- Keeps only the most recent entry (by created_at) for each (restaurant_id, date, platform)
CREATE OR REPLACE VIEW public.daily_sales_uber_deduped AS
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

-- Add index to speed up queries on the base table
CREATE INDEX IF NOT EXISTS idx_daily_sales_uber_dedup 
ON public.daily_sales_uber (restaurant_id, date, platform, created_at DESC);