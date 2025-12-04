-- Create csv_imports table to track import history
CREATE TABLE public.csv_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_size INTEGER,
  report_type TEXT NOT NULL,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Import statistics
  total_rows INTEGER DEFAULT 0,
  inserted_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Metadata
  date_range_start DATE,
  date_range_end DATE,
  restaurants_count INTEGER DEFAULT 0,
  restaurant_ids UUID[],
  
  -- Original file storage
  file_url TEXT,
  
  status TEXT DEFAULT 'completed'
);

-- Enable RLS
ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all on csv_imports" ON public.csv_imports FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for CSV files
INSERT INTO storage.buckets (id, name, public) VALUES ('csv-imports', 'csv-imports', false);

-- Storage policies for csv-imports bucket
CREATE POLICY "Allow read csv-imports" ON storage.objects FOR SELECT USING (bucket_id = 'csv-imports');
CREATE POLICY "Allow insert csv-imports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'csv-imports');
CREATE POLICY "Allow delete csv-imports" ON storage.objects FOR DELETE USING (bucket_id = 'csv-imports');