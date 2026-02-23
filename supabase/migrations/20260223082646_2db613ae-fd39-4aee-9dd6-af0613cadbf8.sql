CREATE POLICY "Allow update whatsapp media"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'whatsapp-media')
WITH CHECK (bucket_id = 'whatsapp-media');