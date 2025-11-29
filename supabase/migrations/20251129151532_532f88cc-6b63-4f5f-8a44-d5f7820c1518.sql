-- Create menu_items table for product catalog
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  food_cost NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for restaurant lookups
CREATE INDEX idx_menu_items_restaurant ON public.menu_items(restaurant_id);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for menu_items
CREATE POLICY "Allow read menu_items for all" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Allow insert menu_items for all" ON public.menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update menu_items for all" ON public.menu_items FOR UPDATE USING (true);
CREATE POLICY "Allow delete menu_items for all" ON public.menu_items FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create action categories enum-like reference
CREATE TABLE public.action_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL
);

INSERT INTO public.action_categories (id, label, icon) VALUES
  ('visuals', 'Visuels', 'camera'),
  ('pricing', 'Tarifs', 'euro'),
  ('promotions', 'Promotions', 'gift'),
  ('marketing', 'Marketing', 'megaphone'),
  ('menu', 'Menu', 'utensils'),
  ('operational', 'Opérationnel', 'settings');

-- Enable RLS on action_categories
ALTER TABLE public.action_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read action_categories for all" ON public.action_categories FOR SELECT USING (true);

-- Create restaurant_actions table
CREATE TABLE public.restaurant_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category TEXT NOT NULL REFERENCES public.action_categories(id),
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  impact_value NUMERIC,
  impact_unit TEXT,
  target_item_ids UUID[] DEFAULT '{}',
  platform TEXT DEFAULT 'all',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_restaurant_actions_restaurant ON public.restaurant_actions(restaurant_id);
CREATE INDEX idx_restaurant_actions_dates ON public.restaurant_actions(start_date, end_date);
CREATE INDEX idx_restaurant_actions_category ON public.restaurant_actions(category);

-- Enable RLS
ALTER TABLE public.restaurant_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies for restaurant_actions
CREATE POLICY "Allow read restaurant_actions for all" ON public.restaurant_actions FOR SELECT USING (true);
CREATE POLICY "Allow insert restaurant_actions for all" ON public.restaurant_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update restaurant_actions for all" ON public.restaurant_actions FOR UPDATE USING (true);
CREATE POLICY "Allow delete restaurant_actions for all" ON public.restaurant_actions FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_restaurant_actions_updated_at
  BEFORE UPDATE ON public.restaurant_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();