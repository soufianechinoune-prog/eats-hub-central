-- Add is_averaged column to daily_conversion table
ALTER TABLE public.daily_conversion 
ADD COLUMN IF NOT EXISTS is_averaged BOOLEAN DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.daily_conversion.is_averaged IS 'True if data was distributed from a multi-day period export, false if exact daily data';