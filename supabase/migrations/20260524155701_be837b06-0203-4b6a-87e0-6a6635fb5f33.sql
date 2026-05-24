
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispute_status text,
  ADD COLUMN IF NOT EXISTS refund_contested_incl_vat numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_contested_excl_vat numeric DEFAULT 0;

COMMENT ON COLUMN public.orders.dispute_status IS
  'Statut du litige de remboursement issu de la colonne "Statut de la commande" du CSV Uber Paiements (commandes). Valeurs: none (commande normale) | refund_only (remboursement à la charge du restaurant) | refund_contested_won (remboursement contesté et récupéré par Uber) | contested_only (ajustement Uber sans débit préalable) | cancelled (commande annulée) | failed (non effectuée).';

COMMENT ON COLUMN public.orders.refund_contested_incl_vat IS
  'Somme TTC des lignes "Remboursements contestés" du CSV Uber pour cette commande (montant recrédité par Uber au restaurant).';

CREATE INDEX IF NOT EXISTS idx_orders_dispute_status
  ON public.orders (restaurant_id, dispute_status)
  WHERE dispute_status IS NOT NULL AND dispute_status <> 'none';
