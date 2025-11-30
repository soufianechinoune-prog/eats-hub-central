-- Create message_history table for tracking individual WhatsApp messages
CREATE TABLE public.message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  restaurant_name TEXT,
  message_content TEXT NOT NULL,
  ultramsg_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, read, failed
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  scheduled_message_id UUID REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;

-- Create permissive policies
CREATE POLICY "Allow all on message_history" 
ON public.message_history 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create indexes for efficient querying
CREATE INDEX idx_message_history_restaurant ON public.message_history(restaurant_id);
CREATE INDEX idx_message_history_status ON public.message_history(status);
CREATE INDEX idx_message_history_ultramsg_id ON public.message_history(ultramsg_message_id);
CREATE INDEX idx_message_history_sent_at ON public.message_history(sent_at DESC);

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_history;