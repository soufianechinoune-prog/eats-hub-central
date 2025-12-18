-- Create managers table
CREATE TABLE public.managers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create manager_restaurants linking table
CREATE TABLE public.manager_restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'manager',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(manager_id, restaurant_id)
);

-- Enable RLS
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_restaurants ENABLE ROW LEVEL SECURITY;

-- RLS policies for managers
CREATE POLICY "Allow all on managers" ON public.managers FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for manager_restaurants
CREATE POLICY "Allow all on manager_restaurants" ON public.manager_restaurants FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_managers_phone ON public.managers(phone);
CREATE INDEX idx_manager_restaurants_manager_id ON public.manager_restaurants(manager_id);
CREATE INDEX idx_manager_restaurants_restaurant_id ON public.manager_restaurants(restaurant_id);

-- Trigger for updated_at on managers
CREATE TRIGGER update_managers_updated_at
  BEFORE UPDATE ON public.managers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();