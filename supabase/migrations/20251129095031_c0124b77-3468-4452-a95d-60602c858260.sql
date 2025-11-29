-- Add platform column to monthly_revenue
ALTER TABLE public.monthly_revenue 
ADD COLUMN platform TEXT NOT NULL DEFAULT 'uber_eats';

-- Add platform column to monthly_conversion
ALTER TABLE public.monthly_conversion 
ADD COLUMN platform TEXT NOT NULL DEFAULT 'uber_eats';

-- Add platform column to monthly_fees
ALTER TABLE public.monthly_fees 
ADD COLUMN platform TEXT NOT NULL DEFAULT 'uber_eats';

-- Drop existing unique constraints and recreate with platform
ALTER TABLE public.monthly_revenue 
DROP CONSTRAINT IF EXISTS monthly_revenue_restaurant_id_year_month_key;

ALTER TABLE public.monthly_revenue 
ADD CONSTRAINT monthly_revenue_restaurant_id_year_month_platform_key 
UNIQUE (restaurant_id, year, month, platform);

ALTER TABLE public.monthly_conversion 
DROP CONSTRAINT IF EXISTS monthly_conversion_restaurant_id_year_month_key;

ALTER TABLE public.monthly_conversion 
ADD CONSTRAINT monthly_conversion_restaurant_id_year_month_platform_key 
UNIQUE (restaurant_id, year, month, platform);

ALTER TABLE public.monthly_fees 
DROP CONSTRAINT IF EXISTS monthly_fees_restaurant_id_year_month_key;

ALTER TABLE public.monthly_fees 
ADD CONSTRAINT monthly_fees_restaurant_id_year_month_platform_key 
UNIQUE (restaurant_id, year, month, platform);

-- Add Deliveroo account manager fields to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN deliveroo_account_manager_name TEXT,
ADD COLUMN deliveroo_account_manager_title TEXT,
ADD COLUMN deliveroo_account_manager_phone TEXT,
ADD COLUMN deliveroo_account_manager_email TEXT,
ADD COLUMN deliveroo_store_id TEXT;