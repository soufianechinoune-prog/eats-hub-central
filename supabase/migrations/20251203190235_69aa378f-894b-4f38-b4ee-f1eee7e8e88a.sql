-- Create payouts table for payout summary reports
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  
  -- Identifiants
  payout_reference_id TEXT NOT NULL,
  payout_date DATE NOT NULL,
  uber_store_id TEXT,
  
  -- Compteurs
  order_count INTEGER DEFAULT 0,
  other_payments_count INTEGER DEFAULT 0,
  
  -- Ventes
  sales_excl_vat NUMERIC DEFAULT 0,
  vat_1_sales NUMERIC DEFAULT 0,
  vat_2_sales NUMERIC DEFAULT 0,
  vat_3_sales NUMERIC DEFAULT 0,
  sales_incl_vat NUMERIC DEFAULT 0,
  
  -- Remboursements
  refund_excl_vat NUMERIC DEFAULT 0,
  vat_refund NUMERIC DEFAULT 0,
  refund_incl_vat NUMERIC DEFAULT 0,
  
  -- Promotions articles
  item_promo_excl_vat NUMERIC DEFAULT 0,
  vat_1_item_promo NUMERIC DEFAULT 0,
  vat_2_item_promo NUMERIC DEFAULT 0,
  vat_3_item_promo NUMERIC DEFAULT 0,
  item_promo_incl_vat NUMERIC DEFAULT 0,
  
  -- Marketing et titre-restaurant
  marketing_fee_adjustment NUMERIC DEFAULT 0,
  meal_voucher_amount NUMERIC DEFAULT 0,
  
  -- Ajustements prix
  price_adjustment_excl_vat NUMERIC DEFAULT 0,
  vat_price_adjustment NUMERIC DEFAULT 0,
  price_adjustment_incl_vat NUMERIC DEFAULT 0,
  
  -- Frais de livraison marchand
  merchant_delivery_fee_excl_vat NUMERIC DEFAULT 0,
  vat_1_merchant_delivery NUMERIC DEFAULT 0,
  vat_2_merchant_delivery NUMERIC DEFAULT 0,
  vat_3_merchant_delivery NUMERIC DEFAULT 0,
  merchant_delivery_fee_incl_vat NUMERIC DEFAULT 0,
  
  -- Emballage
  packaging_fee NUMERIC DEFAULT 0,
  vat_packaging_fee NUMERIC DEFAULT 0,
  bag_fee NUMERIC DEFAULT 0,
  
  -- Promotions livraison
  delivery_promo_excl_vat NUMERIC DEFAULT 0,
  vat_delivery_promo NUMERIC DEFAULT 0,
  delivery_promo_incl_vat NUMERIC DEFAULT 0,
  
  -- Total commande
  order_total_incl_vat NUMERIC DEFAULT 0,
  
  -- Coût livraison
  delivery_cost_excl_vat NUMERIC DEFAULT 0,
  vat_delivery_cost NUMERIC DEFAULT 0,
  delivery_cost_incl_vat NUMERIC DEFAULT 0,
  
  -- Frais Uber
  uber_fee_before_promo_excl_vat NUMERIC DEFAULT 0,
  uber_fee_promo_excl_vat NUMERIC DEFAULT 0,
  uber_fee_after_promo_excl_vat NUMERIC DEFAULT 0,
  vat_uber_fee NUMERIC DEFAULT 0,
  uber_fee_after_promo_incl_vat NUMERIC DEFAULT 0,
  
  -- Autres
  vat_adjustment NUMERIC DEFAULT 0,
  delivery_fee_gain NUMERIC DEFAULT 0,
  tips NUMERIC DEFAULT 0,
  other_payments_incl_vat NUMERIC DEFAULT 0,
  
  -- Montant net
  net_payout NUMERIC DEFAULT 0,
  
  -- Métadonnées
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Contrainte d'unicité
  UNIQUE(restaurant_id, payout_reference_id)
);

-- Enable RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all on payouts" ON public.payouts FOR ALL USING (true) WITH CHECK (true);

-- Index pour recherche
CREATE INDEX idx_payouts_date ON public.payouts(payout_date);
CREATE INDEX idx_payouts_restaurant ON public.payouts(restaurant_id);
CREATE INDEX idx_payouts_reference ON public.payouts(payout_reference_id);