-- Add columns to store report date context for sub-reports
ALTER TABLE message_history 
ADD COLUMN IF NOT EXISTS report_start_date DATE,
ADD COLUMN IF NOT EXISTS report_end_date DATE;

-- Add comment for clarity
COMMENT ON COLUMN message_history.report_start_date IS 'Start date of the report period (used for interactive sub-reports)';
COMMENT ON COLUMN message_history.report_end_date IS 'End date of the report period (used for interactive sub-reports)';