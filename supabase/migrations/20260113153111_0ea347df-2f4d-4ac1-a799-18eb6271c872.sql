-- Add bulk_import_id column to csv_imports table for tracking import sessions
ALTER TABLE public.csv_imports 
ADD COLUMN bulk_import_id UUID;

-- Create index for faster lookups when canceling imports
CREATE INDEX idx_csv_imports_bulk_import_id ON public.csv_imports(bulk_import_id);