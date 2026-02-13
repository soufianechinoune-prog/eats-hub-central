

## Creer Chicken Street - Sens en base

### Contexte
Sens (ligne 90 du CSV) est un nouveau restaurant pas encore ouvert, en statut "waiting for activation" sur Uber Eats. Il a deja un UUID attribue. L'objectif est de le pre-configurer en base comme pour Creteil.

### Donnees a inserer

**Table `restaurants`** (nouvelle ligne) :

| Champ | Valeur |
|---|---|
| name | Chicken Street - Sens |
| chain_id | 110e05b8-5136-45cc-a385-265360104844 (Chicken Street) |
| uber_store_id | f6dc1225-8824-5631-b984-de71813fcbda |
| address | Chemin des Cannetieres, Sens |
| postal_code | 89100 |
| uber_opening_date | NULL (pas encore ouvert) |

**Table `restaurant_uber_ids`** (mapping UUID) :

| Champ | Valeur |
|---|---|
| restaurant_id | (ID genere ci-dessus) |
| uber_store_id | f6dc1225-8824-5631-b984-de71813fcbda |
| is_primary | true |
| label | NULL |

### Detail technique
- INSERT dans `restaurants` avec le chain_id Chicken Street existant
- INSERT dans `restaurant_uber_ids` pour le mapping UUID
- Aucune modification de code necessaire
- Quand le restaurant ouvrira et que les premiers rapports seront importes, les donnees seront automatiquement rattachees a cette fiche

