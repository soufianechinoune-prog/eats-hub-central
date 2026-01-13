
-- Fonction pour calculer et mettre à jour le taux de commission Uber réel par restaurant
CREATE OR REPLACE FUNCTION public.update_uber_commission_rates()
RETURNS TABLE(
  restaurant_id uuid,
  restaurant_name text,
  old_rate numeric,
  new_rate numeric,
  payout_count integer
) AS $$
BEGIN
  RETURN QUERY
  WITH calculated_rates AS (
    SELECT 
      p.restaurant_id,
      COUNT(*)::integer as payout_count,
      CASE 
        WHEN SUM(p.sales_incl_vat - p.item_promo_incl_vat) > 0 
        THEN ROUND(ABS(SUM(p.uber_fee_after_promo_excl_vat)) / (SUM(p.sales_incl_vat - p.item_promo_incl_vat) / 1.20) * 100, 2)
        ELSE NULL 
      END as commission_rate
    FROM payouts p
    WHERE p.sales_incl_vat > 0
    GROUP BY p.restaurant_id
    HAVING COUNT(*) >= 1
  )
  UPDATE restaurants r
  SET uber_commission_rate = cr.commission_rate
  FROM calculated_rates cr
  WHERE r.id = cr.restaurant_id
    AND cr.commission_rate IS NOT NULL
  RETURNING 
    r.id,
    r.name,
    (SELECT uber_commission_rate FROM restaurants WHERE id = r.id),
    cr.commission_rate,
    cr.payout_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger pour mettre à jour automatiquement le taux après chaque insertion dans payouts
CREATE OR REPLACE FUNCTION public.update_restaurant_commission_on_payout()
RETURNS TRIGGER AS $$
DECLARE
  new_rate numeric;
BEGIN
  -- Calculer le nouveau taux pour ce restaurant
  SELECT 
    CASE 
      WHEN SUM(sales_incl_vat - item_promo_incl_vat) > 0 
      THEN ROUND(ABS(SUM(uber_fee_after_promo_excl_vat)) / (SUM(sales_incl_vat - item_promo_incl_vat) / 1.20) * 100, 2)
      ELSE NULL 
    END INTO new_rate
  FROM payouts
  WHERE restaurant_id = NEW.restaurant_id
    AND sales_incl_vat > 0;
  
  -- Mettre à jour le restaurant si on a un taux valide
  IF new_rate IS NOT NULL THEN
    UPDATE restaurants
    SET uber_commission_rate = new_rate
    WHERE id = NEW.restaurant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le trigger sur la table payouts
DROP TRIGGER IF EXISTS update_commission_on_payout_insert ON payouts;
CREATE TRIGGER update_commission_on_payout_insert
  AFTER INSERT OR UPDATE ON payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_restaurant_commission_on_payout();

-- Exécuter la mise à jour initiale pour tous les restaurants avec des données payouts
UPDATE restaurants r
SET uber_commission_rate = cr.commission_rate
FROM (
  SELECT 
    p.restaurant_id,
    CASE 
      WHEN SUM(p.sales_incl_vat - p.item_promo_incl_vat) > 0 
      THEN ROUND(ABS(SUM(p.uber_fee_after_promo_excl_vat)) / (SUM(p.sales_incl_vat - p.item_promo_incl_vat) / 1.20) * 100, 2)
      ELSE NULL 
    END as commission_rate
  FROM payouts p
  WHERE p.sales_incl_vat > 0
  GROUP BY p.restaurant_id
) cr
WHERE r.id = cr.restaurant_id
  AND cr.commission_rate IS NOT NULL;
