-- Extend orders table with comprehensive financial breakdown from Uber Eats payment reports
-- This adds all the granular financial data from "Informations de paiement" level commande

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS uber_flow_id text,
ADD COLUMN IF NOT EXISTS order_channel text,
ADD COLUMN IF NOT EXISTS uber_one_status text,
ADD COLUMN IF NOT EXISTS fulfillment_type text,

-- Sales breakdown
ADD COLUMN IF NOT EXISTS sales_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_1_sales numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_2_sales numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_3_sales numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_incl_vat numeric DEFAULT 0,

-- Refunds breakdown
ADD COLUMN IF NOT EXISTS refund_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_1_refund numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_2_refund numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_3_refund numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_incl_vat numeric DEFAULT 0,

-- Item promotions breakdown
ADD COLUMN IF NOT EXISTS item_promo_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_1_item_promo numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_2_item_promo numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_3_item_promo numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS item_promo_incl_vat numeric DEFAULT 0,

-- Marketing and adjustments
ADD COLUMN IF NOT EXISTS marketing_fee_adjustment numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS meal_voucher_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS meal_voucher_provider text,
ADD COLUMN IF NOT EXISTS price_adjustment_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_price_adjustment numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_adjustment_incl_vat numeric DEFAULT 0,

-- Merchant delivery fees (when merchant delivers)
ADD COLUMN IF NOT EXISTS merchant_delivery_fee_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_1_merchant_delivery numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_2_merchant_delivery numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_3_merchant_delivery numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS merchant_delivery_fee_incl_vat numeric DEFAULT 0,

-- Packaging and bag fees
ADD COLUMN IF NOT EXISTS packaging_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_packaging_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bag_fee numeric DEFAULT 0,

-- Delivery promotions
ADD COLUMN IF NOT EXISTS delivery_promo_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_delivery_promo numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_promo_incl_vat numeric DEFAULT 0,

-- Order totals
ADD COLUMN IF NOT EXISTS order_total_incl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_invoice_url text,

-- Delivery cost (to courier)
ADD COLUMN IF NOT EXISTS delivery_cost_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_delivery_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_cost_incl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS courier_invoice_url text,

-- Uber service fees
ADD COLUMN IF NOT EXISTS uber_fee_before_promo_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS uber_fee_promo_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS uber_fee_after_promo_excl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_uber_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS uber_fee_after_promo_incl_vat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS uber_invoice_url text,

-- Other financial data
ADD COLUMN IF NOT EXISTS vat_adjustment numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_fee_gain numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_payments_description text,
ADD COLUMN IF NOT EXISTS other_payments_incl_vat numeric DEFAULT 0,

-- Payout info
ADD COLUMN IF NOT EXISTS net_payout numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_date date,
ADD COLUMN IF NOT EXISTS payout_reference_id text,
ADD COLUMN IF NOT EXISTS loyalty_id text,

-- Report import tracking
ADD COLUMN IF NOT EXISTS imported_from_report boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS report_import_date timestamp with time zone;

-- Create index on payout_reference_id for linking to payout summaries
CREATE INDEX IF NOT EXISTS idx_orders_payout_reference ON public.orders(payout_reference_id);

-- Create index on uber_flow_id for lookups
CREATE INDEX IF NOT EXISTS idx_orders_uber_flow_id ON public.orders(uber_flow_id);