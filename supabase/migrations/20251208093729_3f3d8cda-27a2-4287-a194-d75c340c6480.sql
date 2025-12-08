-- Create hourly_availability table for granular downtime tracking
CREATE TABLE public.hourly_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  hour_start TIMESTAMP WITH TIME ZONE NOT NULL,
  menu_availability_minutes INTEGER NOT NULL DEFAULT 0,
  online_minutes INTEGER NOT NULL DEFAULT 0,
  offline_minutes INTEGER NOT NULL DEFAULT 0,
  platform TEXT NOT NULL DEFAULT 'uber_eats',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(restaurant_id, hour_start, platform)
);

-- Enable RLS
ALTER TABLE public.hourly_availability ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all on hourly_availability" 
ON public.hourly_availability 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_hourly_availability_restaurant_date ON public.hourly_availability(restaurant_id, hour_start);
CREATE INDEX idx_hourly_availability_hour_start ON public.hourly_availability(hour_start);