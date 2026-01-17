-- Ajouter la colonne eco_contribution_refund aux tables orders et payouts
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eco_contribution_refund NUMERIC DEFAULT 0;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS eco_contribution_refund NUMERIC DEFAULT 0;

-- Commentaires explicatifs
COMMENT ON COLUMN orders.eco_contribution_refund IS 'Remboursement éco-contribution (lignes sans uber_order_id avec Autres frais positif)';
COMMENT ON COLUMN payouts.eco_contribution_refund IS 'Total remboursement éco-contribution agrégé sur le versement';