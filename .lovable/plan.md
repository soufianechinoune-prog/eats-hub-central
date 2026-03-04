

# Ajouter les mappings Deliveroo pour Chicken Street Original - Oberkampf

## Constat
Le restaurant **Chicken Street Original - Oberkampf** (ID `2c465c84-9e4a-4065-a444-886a219493cb`) n'a aucun mapping Deliveroo. Les CSV utilisent deux noms différents :
1. `CHICKEN STREET - Oberkampf 🌯` (anciens fichiers)
2. `CS Orignial by Chicken Street 🌯` (fichiers récents)

Aucune entrée n'existe dans `restaurant_deliveroo_ids` pour ce restaurant.

## Solution
Insérer les deux mappings dans `restaurant_deliveroo_ids` :

```sql
INSERT INTO restaurant_deliveroo_ids (restaurant_id, deliveroo_store_name, is_primary, label)
VALUES 
  ('2c465c84-9e4a-4065-a444-886a219493cb', 'CHICKEN STREET - Oberkampf 🌯', true, 'principal'),
  ('2c465c84-9e4a-4065-a444-886a219493cb', 'CS Orignial by Chicken Street 🌯', false, 'alias rebrand');
```

Aucun changement de code requis -- le parser multi-mapping existant résoudra automatiquement les deux noms.

