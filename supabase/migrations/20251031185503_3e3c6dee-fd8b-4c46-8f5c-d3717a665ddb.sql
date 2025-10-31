-- Create reports table for Uber Eats reporting
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  report_type TEXT NOT NULL,
  workflow_id TEXT,
  job_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sections JSONB,
  start_time_ms BIGINT,
  end_time_ms BIGINT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create webhook_logs table if not exists
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  store_id TEXT,
  webhook_uuid TEXT,
  payload JSONB,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reports
CREATE POLICY "authenticated_users_all_reports"
  ON public.reports
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for webhook_logs
CREATE POLICY "authenticated_users_all_webhook_logs"
  ON public.webhook_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_reports_restaurant_id ON public.reports(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reports_workflow_id ON public.reports(workflow_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON public.webhook_logs(event_type);