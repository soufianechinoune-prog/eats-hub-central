-- Create scheduled_messages table
CREATE TABLE public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  message TEXT NOT NULL,
  recipients JSONB NOT NULL, -- Array of {restaurant_id, phone, name, restaurantName}
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, sent, failed
  sent_at TIMESTAMP WITH TIME ZONE,
  results JSONB, -- Results from Ultramsg API
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Create permissive policies
CREATE POLICY "Allow all on scheduled_messages" 
ON public.scheduled_messages 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for efficient querying of pending messages
CREATE INDEX idx_scheduled_messages_pending 
ON public.scheduled_messages (scheduled_at) 
WHERE status = 'pending';

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;