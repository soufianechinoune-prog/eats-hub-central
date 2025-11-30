-- Add media support to scheduled_messages table
ALTER TABLE public.scheduled_messages
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;