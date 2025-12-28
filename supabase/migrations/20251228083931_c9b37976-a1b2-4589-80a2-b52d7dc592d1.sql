-- Add imported_at column to track when data was last imported
ALTER TABLE daily_order_accuracy 
ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Also add to monthly_order_accuracy for consistency
ALTER TABLE monthly_order_accuracy 
ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE DEFAULT now();