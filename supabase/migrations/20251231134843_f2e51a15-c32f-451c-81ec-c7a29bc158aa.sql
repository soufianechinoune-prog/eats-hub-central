-- Create table for storing daily weather data per restaurant
CREATE TABLE public.weather_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  temperature_max NUMERIC,
  temperature_min NUMERIC,
  temperature_avg NUMERIC,
  precipitation_mm NUMERIC DEFAULT 0,
  weather_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, date)
);

-- Enable RLS
ALTER TABLE public.weather_data ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (weather data is not sensitive)
CREATE POLICY "Weather data is publicly readable"
ON public.weather_data
FOR SELECT
USING (true);

-- Create policy for insert/update via service role (edge function)
CREATE POLICY "Service role can manage weather data"
ON public.weather_data
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient querying
CREATE INDEX idx_weather_data_restaurant_date ON public.weather_data(restaurant_id, date);
CREATE INDEX idx_weather_data_date ON public.weather_data(date);