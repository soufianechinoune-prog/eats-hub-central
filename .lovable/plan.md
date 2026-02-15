

# Conserver toutes les donnees du rapport de paiement

## Etape 1 : Migration base de donnees

Creer la table `payout_adjustments` et ajouter `extra_columns` a la table `orders`.

### Table `payout_adjustments`

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| restaurant_id | uuid (nullable) | Restaurant si identifiable via uber_store_id |
| uber_store_id | text | UUID du restaurant Uber |
| restaurant_name | text | Nom du restaurant depuis le CSV |
| payout_reference_id | text | Reference du versement |
| payout_date | date | Date du versement |
| description | text | Contenu de "Description des autres paiements" |
| category | text | `advertising`, `eco_contribution`, `other_fee`, `adjustment` |
| amount | numeric | Montant |
| raw_columns | jsonb | Toutes les colonnes CSV brutes |
| created_at | timestamptz | Date d'import |

Contrainte unique sur `(payout_reference_id, description, uber_store_id)` pour eviter les doublons.

### Colonne `extra_columns` sur `orders`

Champ `jsonb` nullable pour stocker toutes les colonnes CSV non mappees.

## Etape 2 : Mise a jour du parser

Modifier `supabase/functions/parse-payment-report/index.ts` :

- Les lignes sans `uber_order_id` sont inserees dans `payout_adjustments` au lieu d'etre ignorees
- Detection automatique de la categorie via mots-cles dans la description
- Stockage de TOUTES les colonnes CSV brutes dans `raw_columns`
- Pour les commandes normales, les colonnes non reconnues par `COLUMN_MAPPING` sont stockees dans `orders.extra_columns`

### Categorisation automatique

```text
description contient "publicitaire" / "advertising" / "ads" -> advertising
description contient "eco" / "contribution"                  -> eco_contribution
description contient "ajustement" / "adjustment"             -> adjustment
sinon                                                        -> other_fee
```

## Etape 3 : Mise a jour de la config d'import

Ajouter `payout_adjustments` dans les `targetTables` du type `payment_order_level` dans `src/lib/reportImportConfig.ts`.

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| Migration SQL | Table `payout_adjustments` + colonne `extra_columns` sur `orders` |
| `supabase/functions/parse-payment-report/index.ts` | Parser les lignes sans order ID + collecter extra columns |
| `src/lib/reportImportConfig.ts` | Ajouter `payout_adjustments` aux tables cibles |

