CREATE POLICY "Authenticated read weekly-reports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'weekly-reports');