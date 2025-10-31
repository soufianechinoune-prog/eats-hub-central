-- Allow pending Uber connections without assigning to a restaurant immediately
ALTER TABLE public.uber_connections
ALTER COLUMN restaurant_id DROP NOT NULL;