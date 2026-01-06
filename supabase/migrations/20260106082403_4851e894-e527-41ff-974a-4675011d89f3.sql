-- Table pour stocker les prix spécifiques par restaurant
CREATE TABLE public.restaurant_menu_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  price_uber NUMERIC NULL,
  price_deliveroo NUMERIC NULL,
  description_override TEXT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Un seul prix par restaurant/produit
  UNIQUE(restaurant_id, menu_item_id)
);

-- Enable RLS
ALTER TABLE public.restaurant_menu_prices ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read restaurant_menu_prices for all" 
ON public.restaurant_menu_prices 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert restaurant_menu_prices for all" 
ON public.restaurant_menu_prices 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update restaurant_menu_prices for all" 
ON public.restaurant_menu_prices 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete restaurant_menu_prices for all" 
ON public.restaurant_menu_prices 
FOR DELETE 
USING (true);

-- Trigger pour updated_at
CREATE TRIGGER update_restaurant_menu_prices_updated_at
BEFORE UPDATE ON public.restaurant_menu_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour les requêtes fréquentes
CREATE INDEX idx_restaurant_menu_prices_restaurant ON public.restaurant_menu_prices(restaurant_id);
CREATE INDEX idx_restaurant_menu_prices_item ON public.restaurant_menu_prices(menu_item_id);