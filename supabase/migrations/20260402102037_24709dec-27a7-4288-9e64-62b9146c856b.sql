
ALTER TABLE public.chains ADD COLUMN IF NOT EXISTS logo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chain-logos', 'chain-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access on chain-logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chain-logos');

CREATE POLICY "Authenticated users can upload chain logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chain-logos');

CREATE POLICY "Authenticated users can update chain logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chain-logos');

CREATE POLICY "Authenticated users can delete chain logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chain-logos');
