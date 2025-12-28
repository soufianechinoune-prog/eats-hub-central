-- Add date range columns to product_issues_ranking table
ALTER TABLE public.product_issues_ranking 
ADD COLUMN IF NOT EXISTS date_range_start DATE,
ADD COLUMN IF NOT EXISTS date_range_end DATE;

-- Create index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_product_issues_ranking_date_range 
ON public.product_issues_ranking (restaurant_id, date_range_start, date_range_end);

-- Drop the old year-based unique constraint if it exists and create a new one with date range
DROP INDEX IF EXISTS idx_product_issues_unique;
CREATE UNIQUE INDEX idx_product_issues_unique 
ON public.product_issues_ranking (restaurant_id, item_title, date_range_start, date_range_end);