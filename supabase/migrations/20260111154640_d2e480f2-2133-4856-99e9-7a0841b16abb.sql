-- Create storage bucket for restaurant documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-documents', 'restaurant-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create table for restaurant documents
CREATE TABLE public.restaurant_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  document_type TEXT NOT NULL DEFAULT 'other', -- 'kbis', 'rib', 'license', 'insurance', 'contract', 'other'
  notes TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restaurant_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all on restaurant_documents"
ON public.restaurant_documents
FOR ALL
USING (true)
WITH CHECK (true);

-- Storage policies for restaurant-documents bucket
CREATE POLICY "Allow public read of restaurant documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-documents');

CREATE POLICY "Allow upload to restaurant documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'restaurant-documents');

CREATE POLICY "Allow delete from restaurant documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'restaurant-documents');