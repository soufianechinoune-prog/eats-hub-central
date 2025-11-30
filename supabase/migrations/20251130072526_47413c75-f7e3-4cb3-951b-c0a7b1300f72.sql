-- Add direction column to message_history for bidirectional conversations
ALTER TABLE public.message_history 
ADD COLUMN direction text NOT NULL DEFAULT 'outbound';

-- Add sender_phone for incoming messages
ALTER TABLE public.message_history 
ADD COLUMN sender_phone text;

-- Create index for conversation queries (group by phone)
CREATE INDEX idx_message_history_conversation 
ON public.message_history (recipient_phone, created_at DESC);

-- Create index for incoming messages lookup
CREATE INDEX idx_message_history_sender 
ON public.message_history (sender_phone, created_at DESC);

-- Add comment for clarity
COMMENT ON COLUMN public.message_history.direction IS 'Message direction: outbound (sent) or inbound (received)';
COMMENT ON COLUMN public.message_history.sender_phone IS 'Sender phone number for inbound messages';