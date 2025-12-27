-- Add unique constraint to prevent duplicates
-- First we need to remove duplicates before adding the constraint

-- Delete rows with period_type = 'previous' that have a matching 'current' entry
DELETE FROM daily_order_accuracy dao
WHERE dao.period_type = 'previous'
AND EXISTS (
  SELECT 1 FROM daily_order_accuracy dao2 
  WHERE dao2.restaurant_id = dao.restaurant_id 
  AND dao2.date = dao.date 
  AND dao2.period_type = 'current'
);

-- Now add the unique constraint
ALTER TABLE daily_order_accuracy
ADD CONSTRAINT daily_order_accuracy_restaurant_date_period_unique 
UNIQUE (restaurant_id, date, period_type);