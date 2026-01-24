-- Ajouter la colonne vat_rate à la table menu_items
ALTER TABLE menu_items 
ADD COLUMN vat_rate NUMERIC(5,2) DEFAULT 10.00;

COMMENT ON COLUMN menu_items.vat_rate IS 'Taux de TVA applicable au produit (en %)';