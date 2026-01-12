-- Ajouter la colonne food_cost_combo pour les produits commandés avec un menu
ALTER TABLE menu_items 
ADD COLUMN food_cost_combo numeric DEFAULT NULL;

-- Commenter les colonnes pour clarté
COMMENT ON COLUMN menu_items.food_cost IS 'Food cost quand le produit est commandé seul (inclut emballage)';
COMMENT ON COLUMN menu_items.food_cost_combo IS 'Food cost quand le produit accompagne un menu (sans emballage additionnel)';