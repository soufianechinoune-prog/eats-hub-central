-- Create table for restaurant opening hours
CREATE TABLE public.restaurant_opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'uber_eats',
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Lundi...6=Dimanche
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_overnight BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, platform, day_of_week, start_time)
);

-- Enable RLS
ALTER TABLE public.restaurant_opening_hours ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for this app)
CREATE POLICY "Allow all operations on restaurant_opening_hours"
ON public.restaurant_opening_hours
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_opening_hours_restaurant ON public.restaurant_opening_hours(restaurant_id);
CREATE INDEX idx_opening_hours_platform ON public.restaurant_opening_hours(platform);

-- Add trigger for updated_at
CREATE TRIGGER update_restaurant_opening_hours_updated_at
BEFORE UPDATE ON public.restaurant_opening_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();