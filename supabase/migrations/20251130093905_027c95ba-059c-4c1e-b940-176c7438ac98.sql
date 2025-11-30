-- Add media_url column to message_history for storing media attachments
ALTER TABLE public.message_history 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;