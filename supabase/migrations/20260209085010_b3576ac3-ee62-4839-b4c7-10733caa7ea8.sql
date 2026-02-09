-- Enable RLS on restaurant_uber_ids
ALTER TABLE public.restaurant_uber_ids ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for the table
CREATE POLICY "Allow all on restaurant_uber_ids" 
ON public.restaurant_uber_ids 
FOR ALL 
USING (true) 
WITH CHECK (true);