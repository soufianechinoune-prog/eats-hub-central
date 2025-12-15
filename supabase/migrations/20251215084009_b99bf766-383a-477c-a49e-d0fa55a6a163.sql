-- Add message_type column to message_history for clean filtering
ALTER TABLE public.message_history 
ADD COLUMN message_type text DEFAULT 'individual';

-- Update existing messages based on content patterns
UPDATE public.message_history 
SET message_type = 'report' 
WHERE message_content LIKE '%📊%' OR message_content LIKE '%rapport%';

UPDATE public.message_history 
SET message_type = 'campaign' 
WHERE campaign_id IS NOT NULL AND message_type = 'individual';

UPDATE public.message_history 
SET message_type = 'chatbot' 
WHERE direction = 'inbound';