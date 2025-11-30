-- Create message_campaigns table for grouping bulk messages
CREATE TABLE public.message_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_template TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sending',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_campaigns ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all on message_campaigns" 
ON public.message_campaigns 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add campaign_id to message_history
ALTER TABLE public.message_history 
ADD COLUMN campaign_id UUID REFERENCES public.message_campaigns(id);

-- Enable realtime for campaigns
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_campaigns;