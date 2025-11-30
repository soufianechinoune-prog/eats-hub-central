-- Add geolocation columns to restaurants table for cartography feature
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS coverage_radius_km numeric DEFAULT 4;