-- Table pour stocker les données du fichier order-accuracy-inaccurate-issues-summary
CREATE TABLE public.monthly_order_accuracy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'current', -- 'current' ou 'previous' pour N-1
  
  -- Nombre de commandes incorrectes par type
  incorrect_orders_count INTEGER NOT NULL DEFAULT 0,
  missing_items_count INTEGER NOT NULL DEFAULT 0,
  missing_customization_count INTEGER NOT NULL DEFAULT 0,
  wrong_order_count INTEGER NOT NULL DEFAULT 0,
  incorrect_item_count INTEGER NOT NULL DEFAULT 0,
  
  -- Remboursements par type (en euros)
  missing_items_refund NUMERIC NOT NULL DEFAULT 0,
  missing_customization_refund NUMERIC NOT NULL DEFAULT 0,
  wrong_order_refund NUMERIC NOT NULL DEFAULT 0,
  incorrect_item_refund NUMERIC NOT NULL DEFAULT 0,
  total_refund NUMERIC NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Contrainte d'unicité
  CONSTRAINT monthly_order_accuracy_unique UNIQUE (restaurant_id, year, month, period_type)
);

-- Table pour stocker le leaderboard des produits problématiques
CREATE TABLE public.product_issues_ranking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  
  -- Données du produit
  item_title TEXT NOT NULL,
  volume INTEGER NOT NULL DEFAULT 0,
  score NUMERIC NOT NULL DEFAULT 0,
  issues_delta_percent NUMERIC,
  major_issue_type TEXT,
  has_missing_customization BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Contrainte d'unicité par restaurant/année/produit
  CONSTRAINT product_issues_ranking_unique UNIQUE (restaurant_id, year, item_title)
);

-- Enable RLS
ALTER TABLE public.monthly_order_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_issues_ranking ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow all on monthly_order_accuracy" ON public.monthly_order_accuracy FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_issues_ranking" ON public.product_issues_ranking FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_monthly_order_accuracy_restaurant_year ON public.monthly_order_accuracy(restaurant_id, year);
CREATE INDEX idx_product_issues_ranking_restaurant_year ON public.product_issues_ranking(restaurant_id, year);