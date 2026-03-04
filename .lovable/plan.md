

# Ajouter le mapping Deliveroo pour Chicken Street (Vienne)

## Probleme
Le restaurant **Chicken Street (Vienne)** n'a aucun mapping Deliveroo configuré. Les CSV utilisent le nom `CHICKEN STREET - Vienne 🌯` mais il n'y a ni `deliveroo_store_id` ni entrée dans `restaurant_deliveroo_ids`.

## Solution
Insérer le mapping dans la table `restaurant_deliveroo_ids` :

```sql
INSERT INTO restaurant_deliveroo_ids (restaurant_id, deliveroo_store_name, is_primary, label)
VALUES ('ac2a0c5e-c328-4196-83ea-7545df7f827b', 'CHICKEN STREET - Vienne 🌯', true, 'principal');
```

C'est une simple insertion en base — aucun changement de code nécessaire. Le parser multi-mapping déjà en place résoudra automatiquement ce nom lors des prochains imports.

