-- Create chains table
CREATE TABLE public.chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create restaurants table
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  uber_store_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create uber_connections table
CREATE TABLE public.uber_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  uber_order_id TEXT UNIQUE NOT NULL,
  status TEXT,
  order_datetime TIMESTAMPTZ,
  gross_amount NUMERIC(10,2),
  net_amount NUMERIC(10,2),
  service_fee NUMERIC(10,2),
  currency TEXT DEFAULT 'EUR',
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create promotions table
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_restaurants_chain_id ON public.restaurants(chain_id);
CREATE INDEX idx_restaurants_is_active ON public.restaurants(is_active);
CREATE INDEX idx_uber_connections_restaurant_id ON public.uber_connections(restaurant_id);
CREATE INDEX idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX idx_orders_order_datetime ON public.orders(order_datetime DESC);
CREATE INDEX idx_orders_uber_order_id ON public.orders(uber_order_id);
CREATE INDEX idx_promotions_restaurant_id ON public.promotions(restaurant_id);
CREATE INDEX idx_promotions_dates ON public.promotions(start_at, end_at);

-- Enable Row Level Security
ALTER TABLE public.chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uber_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for authenticated users - admin only app)
CREATE POLICY "Allow all operations for authenticated users" ON public.chains
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON public.restaurants
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON public.uber_connections
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON public.orders
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON public.promotions
  FOR ALL USING (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for development
INSERT INTO public.chains (name, description) VALUES 
  ('Chicken Street', 'Chaîne de restaurants de poulet frit premium avec plus de 100 points de vente');

-- Insert sample restaurants
INSERT INTO public.restaurants (chain_id, name, city, is_active) 
SELECT 
  id,
  'Chicken Street ' || city,
  city,
  true
FROM public.chains, 
  (VALUES ('Paris'), ('Lyon'), ('Marseille'), ('Toulouse'), ('Nice')) AS cities(city)
WHERE name = 'Chicken Street';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;