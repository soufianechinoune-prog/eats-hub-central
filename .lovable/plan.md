

# Ajouter le mapping Deliveroo pour "Chicken Street - Gare de Dijon"

## Constat
Les fichiers `CSD2_20250908` et `CSD2_20250915` utilisent le nom **`Chicken Street - Gare de Dijon`** (sans emoji, ordre inversé). Le mapping existant est `CHICKEN STREET - Dijon Gare 🌯` pour le restaurant **Chicken street - Dijon Gare** (ID `3c56a904-cd53-4084-9be1-8076f27e8792`).

## Solution
Insérer un alias dans `restaurant_deliveroo_ids` :

```sql
INSERT INTO restaurant_deliveroo_ids (restaurant_id, deliveroo_store_name, is_primary, label)
VALUES ('3c56a904-cd53-4084-9be1-8076f27e8792', 'Chicken Street - Gare de Dijon', false, 'alias ancien format');
```

Aucun changement de code requis — le parser multi-mapping résoudra automatiquement ce nom.

