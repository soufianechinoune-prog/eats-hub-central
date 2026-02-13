

## Mise à jour Chicken Street - Poitiers (ligne 80)

### Etat actuel en base

| Champ | Valeur actuelle |
|---|---|
| Restaurant | Chicken Street - Poitiers |
| ID interne | 156e7a6e-8607-4f12-9134-e57b18197e9b |
| UUID | 06b8d554-6304-553f-9f44-0dfe0d8578b3 (correct) |
| is_active | true |
| csv_verified | false |
| uber_opening_date | null |

### Donnees du CSV (ligne 80)

| Champ | Valeur |
|---|---|
| Statut | waiting for activation |
| is_visible | FALSE |
| creation_date | 2025-08-29 |
| first_request_date | null |
| Adresse | 2 Avenue de Lafayette, Poitiers 86000 |

### Action

Mettre a jour les metadonnees pour refleter le statut "en attente d'activation" :

```sql
UPDATE restaurants
SET csv_verified = true,
    is_active = false,
    address = '2 Avenue de Lafayette, Poitiers 86000'
WHERE id = '156e7a6e-8607-4f12-9134-e57b18197e9b';
```

- `csv_verified = true` : confirme par le CSV maitre
- `is_active = false` : pas encore ouvert (waiting for activation)
- `address` : mise a jour depuis le CSV
- `uber_opening_date` reste null car `first_request_date` est vide (pas encore de premiere commande)

### Resultat attendu

- Le restaurant apparaitra avec le statut "Ferme" (badge rouge) en attendant son activation
- Des que les premiers rapports arriveront, les donnees seront automatiquement rattachees
- Aucune modification de code necessaire

