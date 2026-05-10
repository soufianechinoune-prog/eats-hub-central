ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS data_source TEXT;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_data_source_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_data_source_check
  CHECK (data_source IN ('uber_api', 'csv_import', 'manual'))
  NOT VALID;
