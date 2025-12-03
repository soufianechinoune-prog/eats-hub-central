-- Extend order_items table for item-level report data
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS uber_order_id TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS uber_flow_id TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS external_data TEXT;

-- Units and weight (for weight-based products)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sold_by_unit TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS estimated_weight NUMERIC;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS requested_weight NUMERIC;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS final_weight NUMERIC;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS requested_count INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS final_count INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS requested_quantity INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS final_quantity INTEGER;

-- Item financial details
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sales_excl_vat NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_1_sales NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_2_sales NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_3_sales NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sales_incl_vat NUMERIC DEFAULT 0;

-- Item refunds
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refund_excl_vat NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_1_refund NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_2_refund NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_3_refund NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refund_incl_vat NUMERIC DEFAULT 0;

-- Item promotions
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_promo_excl_vat NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_1_item_promo NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_2_item_promo NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vat_3_item_promo NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_promo_incl_vat NUMERIC DEFAULT 0;

-- Import tracking
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS imported_from_report BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS report_import_date TIMESTAMPTZ;

-- Indexes for linking
CREATE INDEX IF NOT EXISTS idx_order_items_uber_flow_id ON order_items(uber_flow_id);
CREATE INDEX IF NOT EXISTS idx_order_items_uber_order_id ON order_items(uber_order_id);