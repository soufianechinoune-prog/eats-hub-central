-- Add batch_id column to message_history for grouping related sends
ALTER TABLE public.message_history ADD COLUMN IF NOT EXISTS batch_id uuid;

-- Create index for fast batch grouping
CREATE INDEX IF NOT EXISTS idx_message_history_batch_id ON public.message_history(batch_id);

-- Comment for documentation
COMMENT ON COLUMN public.message_history.batch_id IS 'Groups related messages sent together (e.g., weekly reports to multiple restaurants)';