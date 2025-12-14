-- Add new columns for frequency and validation mode
ALTER TABLE public.report_templates 
ADD COLUMN IF NOT EXISTS schedule_frequency text DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS schedule_day_of_month integer,
ADD COLUMN IF NOT EXISTS requires_validation boolean DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.report_templates.schedule_frequency IS 'weekly, bimonthly, monthly';
COMMENT ON COLUMN public.report_templates.schedule_day_of_month IS 'Day of month for monthly frequency (1-31)';
COMMENT ON COLUMN public.report_templates.requires_validation IS 'If true, scheduled sends require manual validation';