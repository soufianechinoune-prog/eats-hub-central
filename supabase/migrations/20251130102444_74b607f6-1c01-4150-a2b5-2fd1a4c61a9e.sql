-- Add subject column to scheduled_messages table
ALTER TABLE public.scheduled_messages 
ADD COLUMN subject text;