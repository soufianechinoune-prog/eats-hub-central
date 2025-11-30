-- Update storage bucket to accept audio formats
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'audio/ogg', 'audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/wav']
WHERE id = 'whatsapp-media';