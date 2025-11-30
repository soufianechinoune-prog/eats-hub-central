-- Create storage bucket for WhatsApp media uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media', 
  'whatsapp-media', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Create storage policies for the bucket
CREATE POLICY "Allow public read access to whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Allow authenticated uploads to whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Allow delete whatsapp media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media');