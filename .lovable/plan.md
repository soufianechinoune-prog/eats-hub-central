

## Pre-configuration de Chicken Street - Poitiers

Comme pour Creteil et Sens, ce restaurant n'est pas encore ouvert (statut "waiting for activation" dans le CSV Uber Eats). On le pre-configure en base pour que les donnees soient automatiquement rattachees des l'ouverture.

### Donnees du CSV (ligne 80)

| Champ | Valeur |
|---|---|
| store_name | Chicken Street - Poitiers |
| uuid | 06b8d554-6304-553f-9f44-0dfe0d8578b3 |
| external_store_id | BYS00629 |
| is_visible | FALSE |
| address | 2 Avenue de Lafayette, Poitiers |
| postal_code | 86000 |
| first_request_date | N/A (pas encore ouvert) |
| statut | waiting for activation |

### Actions a realiser

**1. INSERT dans `restaurants`**
- name: Chicken Street - Poitiers
- chain_id: 110e05b8-5136-45cc-a385-265360104844 (Chicken Street)
- uber_store_id: 06b8d554-6304-553f-9f44-0dfe0d8578b3
- address: 2 Avenue de Lafayette, Poitiers
- postal_code: 86000
- uber_opening_date: NULL (pas encore ouvert)

**2. INSERT dans `restaurant_uber_ids`**
- Mapping du UUID comme is_primary = true

### Detail technique

```sql
WITH new_restaurant AS (
  INSERT INTO restaurants (name, chain_id, uber_store_id, address, postal_code, uber_opening_date)
  VALUES (
    'Chicken Street - Poitiers',
    '110e05b8-5136-45cc-a385-265360104844',
    '06b8d554-6304-553f-9f44-0dfe0d8578b3',
    '2 Avenue de Lafayette, Poitiers',
    '86000',
    NULL
  )
  RETURNING id
)
INSERT INTO restaurant_uber_ids (restaurant_id, uber_store_id, is_primary)
SELECT id, '06b8d554-6304-553f-9f44-0dfe0d8578b3', true FROM new_restaurant;
```

Aucune modification de code necessaire. Les donnees seront automatiquement rattachees a cette fiche des l'importation des premiers rapports.

