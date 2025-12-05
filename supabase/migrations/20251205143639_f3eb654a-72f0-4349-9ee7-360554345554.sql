-- Create storage bucket for import guide screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('import-guide-screenshots', 'import-guide-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Public read access for import guide screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'import-guide-screenshots');

-- Create policy for authenticated/anonymous upload (since no auth in this app)
CREATE POLICY "Allow uploads to import guide screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'import-guide-screenshots');

-- Create policy for delete
CREATE POLICY "Allow delete from import guide screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'import-guide-screenshots');

-- Create table to store screenshot references
CREATE TABLE public.import_guide_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_section_id TEXT NOT NULL UNIQUE,
  screenshot_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.import_guide_screenshots ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth in this app)
CREATE POLICY "Allow all on import_guide_screenshots"
ON public.import_guide_screenshots FOR ALL
USING (true)
WITH CHECK (true);