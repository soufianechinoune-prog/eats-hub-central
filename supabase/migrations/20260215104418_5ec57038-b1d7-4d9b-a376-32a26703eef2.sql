
-- 1. Drop the expression-based unique index
DROP INDEX IF EXISTS order_errors_dedup_idx;

-- 2. Clean up existing NULL values
UPDATE order_errors SET item_title = '' WHERE item_title IS NULL;

-- 3. Make item_title NOT NULL with default ''
ALTER TABLE order_errors ALTER COLUMN item_title SET DEFAULT '';
ALTER TABLE order_errors ALTER COLUMN item_title SET NOT NULL;

-- 4. Create a simple unique index matching the ON CONFLICT clause
CREATE UNIQUE INDEX order_errors_dedup_idx ON order_errors (restaurant_id, uber_order_id, item_title);
