-- Add Telegram support to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS manager_telegram TEXT;

-- Add channel column to message_history to distinguish WhatsApp from Telegram
ALTER TABLE public.message_history 
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';

-- Add channel column to scheduled_messages for scheduled Telegram messages
ALTER TABLE public.scheduled_messages 
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';

-- Create index for faster filtering by channel
CREATE INDEX IF NOT EXISTS idx_message_history_channel ON public.message_history(channel);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_channel ON public.scheduled_messages(channel);