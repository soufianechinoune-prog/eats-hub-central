-- Table pour stocker les scores de succès mensuels des restaurants
CREATE TABLE public.success_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  score_month DATE NOT NULL, -- Premier jour du mois évalué
  score_tier TEXT NOT NULL CHECK (score_tier IN ('Excellent', 'Great', 'Good', 'Fair', 'Poor')),
  operational_excellence NUMERIC(5,2), -- Pourcentage 0-100
  ratings NUMERIC(3,2), -- Note moyenne 0-5
  menu_details NUMERIC(5,2), -- Pourcentage 0-100
  sustainable_packaging NUMERIC(5,2), -- Pourcentage 0-100 (nullable car pas dans tous les marchés)
  sales_amount NUMERIC(12,2), -- CA pour référence
  currency_code TEXT DEFAULT 'EUR',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, score_month)
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_success_scores_restaurant_month ON public.success_scores(restaurant_id, score_month DESC);
CREATE INDEX idx_success_scores_month ON public.success_scores(score_month DESC);

-- RLS policies
ALTER TABLE public.success_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on success_scores"
ON public.success_scores
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on success_scores"
ON public.success_scores
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update on success_scores"
ON public.success_scores
FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete on success_scores"
ON public.success_scores
FOR DELETE
USING (true);

-- Trigger pour updated_at
CREATE TRIGGER update_success_scores_updated_at
BEFORE UPDATE ON public.success_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();