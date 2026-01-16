-- Corriger les commandes où sales_incl_vat a été doublé/triplé par le parser
-- Formule correcte : sales_incl_vat = order_total_incl_vat + ABS(item_promo_incl_vat)
UPDATE orders
SET sales_incl_vat = order_total_incl_vat + ABS(COALESCE(item_promo_incl_vat, 0))
WHERE order_datetime >= '2025-01-01'
  AND order_total_incl_vat > 0
  AND sales_incl_vat IS NOT NULL
  AND (sales_incl_vat / NULLIF(order_total_incl_vat, 0)) > 1.85;