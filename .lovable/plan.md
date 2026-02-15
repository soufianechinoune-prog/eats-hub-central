

# Conserver toutes les donnees du rapport de paiement

## Le probleme actuel

Le parser `parse-payment-report` ignore les lignes CSV sans `Id. de la commande`. Ces lignes contiennent pourtant des donnees financieres importantes :
- **Depenses publicitaires** (montants factures par Uber pour les campagnes ads)
- **Eco-contributions** (frais environnementaux)
- **Autres frais** et ajustements divers au niveau du versement

Aujourd'hui, seules les eco-contributions sont partiellement detectees (pour diagnostic), mais rien n'est persiste en base.

De plus, si Uber ajoute de nouvelles colonnes au CSV a l'avenir, elles seront silencieusement ignorees.

## La solution

### 1. Nouvelle table `payout_adjustments`

Creer une table dediee pour stocker toutes les lignes du CSV qui n'ont pas d'identifiant de commande. Chaque ligne devient un enregistrement avec :

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| restaurant_id | uuid (nullable) | Restaurant si identifiable via uber_store_id |
| uber_store_id | text | UUID du restaurant Uber (tel que dans le CSV) |
| restaurant_name | text | Nom du restaurant depuis le CSV |
| payout_reference_id | text | Reference du versement |
| payout_date | date | Date du versement |
| description | text | Contenu de "Description des autres paiements" |
| category | text | Categorie auto-detectee : `advertising`, `eco_contribution`, `other_fee`, `adjustment` |
| amount | numeric | Montant (depuis "Autres paiements TTC" ou "Montant total") |
| raw_columns | jsonb | TOUTES les colonnes de la ligne CSV brute (cle = en-tete, valeur = contenu) |
| created_at | timestamptz | Date d'import |

### 2. Champ `extra_columns` sur la table `orders`

Ajouter une colonne `extra_columns jsonb` a la table `orders` existante. Pour chaque ligne de commande, toutes les colonnes CSV non mappees dans `COLUMN_MAPPING` seront stockees dans ce champ JSON. Ainsi, si Uber ajoute une colonne demain, elle sera automatiquement conservee sans modifier le code.

### 3. Modification du parser

Au lieu d'ignorer les lignes sans order ID, le parser les inserera dans `payout_adjustments` avec :
- Detection automatique de la categorie (`advertising`, `eco_contribution`, etc.)
- Stockage de TOUTES les colonnes CSV brutes dans `raw_columns`

Pour les lignes de commande normales, les colonnes non reconnues seront stockees dans `extra_columns`.

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| Migration SQL | Creer la table `payout_adjustments` + ajouter `extra_columns` a `orders` |
| `supabase/functions/parse-payment-report/index.ts` | Inserer les lignes sans order ID dans `payout_adjustments` au lieu de les ignorer ; collecter les colonnes non mappees dans `extra_columns` |

## Detail technique

### Categorisation automatique des ajustements

```text
description contient "publicitaire" ou "advertising" ou "ads" -> category = "advertising"
description contient "eco" ou "contribution" ou "environnement"  -> category = "eco_contribution"  
description contient "ajustement" ou "adjustment"                -> category = "adjustment"
sinon                                                            -> category = "other_fee"
```

### Stockage des colonnes brutes (raw_columns)

Pour chaque ligne sans order ID, on construit un objet JSON avec TOUTES les colonnes :
```text
{
  "Id. du flux": "xyz",
  "Nom du restaurant": "Mon Resto",
  "Description des autres paiements": "Depenses publicitaires",
  "Autres paiements (TVA incluse)": "-45.50",
  "Montant total": "-45.50",
  "Date du versement": "15/02/2026",
  ... (toutes les colonnes du CSV)
}
```

### Extra columns pour les commandes

Pour chaque ligne de commande, les colonnes CSV non presentes dans `COLUMN_MAPPING` sont collectees dans un objet JSON et stockees dans `orders.extra_columns`. Cela garantit que toute nouvelle colonne ajoutee par Uber sera preservee automatiquement.

### Upsert des ajustements

Cle d'upsert sur `payout_adjustments` : combinaison `(payout_reference_id, description, uber_store_id)` pour eviter les doublons lors de reimportations.

