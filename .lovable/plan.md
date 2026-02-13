

## Ajout de l'ancien UUID Colombes en secondaire

### Restaurant concerne

| Champ | Valeur |
|---|---|
| Restaurant | Chicken Street - Colombes |
| ID interne | 0d9ed512-8795-4c4c-a99d-3243de95d95f |
| UUID actif (principal) | 7ef325e8-0c56-564f-b677-5f7c2b60e674 |

### Action

Inserer l'ancien UUID comme entree secondaire dans `restaurant_uber_ids` :

```sql
INSERT INTO restaurant_uber_ids (restaurant_id, uber_store_id, is_primary, label)
VALUES (
  '0d9ed512-8795-4c4c-a99d-3243de95d95f',
  'dca44878-e375-41b9-8580-39f930697916',
  false,
  'ancien compte (ferme 2025-06-11)'
);
```

Mettre a jour `uber_opening_date` du restaurant pour refleter la date d'ouverture de l'ancien compte (ouvert depuis 2019 selon le CSV) :

```sql
UPDATE restaurants
SET uber_opening_date = '2019-09-12'
WHERE id = '0d9ed512-8795-4c4c-a99d-3243de95d95f';
```

### Resultat attendu

- L'ancien UUID sera reconnu automatiquement lors d'imports de rapports historiques
- La date d'ouverture refletera l'historique complet du restaurant
- Aucune modification de code necessaire

