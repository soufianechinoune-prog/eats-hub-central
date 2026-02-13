

## Creer Chicken Street - Creteil en base

### Contexte
Creteil (ligne 114 du CSV) est un nouveau restaurant pas encore ouvert, en statut "waiting for activation" sur Uber Eats. Il a deja un UUID attribue. L'objectif est de le pre-configurer en base pour que les futurs imports de rapports le reconnaissent automatiquement.

### Donnees a inserer

**Table `restaurants`** (nouvelle ligne) :

| Champ | Valeur |
|---|---|
| name | Chicken Street - Creteil |
| chain_id | 110e05b8-5136-45cc-a385-265360104844 (Chicken Street) |
| uber_store_id | 494adb5f-e40b-5dea-b00c-15ca91f754ae |
| address | 126 avenue du Marechal Foch, Creteil |
| postal_code | 94000 |
| uber_opening_date | NULL (pas encore ouvert) |

**Table `restaurant_uber_ids`** (mapping UUID) :

| Champ | Valeur |
|---|---|
| restaurant_id | (ID genere ci-dessus) |
| uber_store_id | 494adb5f-e40b-5dea-b00c-15ca91f754ae |
| is_primary | true |
| label | NULL |

### Detail technique
- INSERT dans `restaurants` avec le chain_id Chicken Street existant
- INSERT dans `restaurant_uber_ids` pour le mapping UUID
- Aucune modification de code necessaire
- Quand le restaurant ouvrira et que les premiers rapports seront importes, les donnees seront automatiquement rattachees a cette fiche

