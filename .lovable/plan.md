
# Dissocier les ajustements d'arrondi TVA de l'eco-contribution

## Probleme

Uber Eats utilise la meme description "Autres frais" pour deux types de flux differents :
1. **Eco-contribution** (minimum 0,1381 EUR par ligne)
2. **Ajustement d'arrondi de TVA** ("Adjustment for invoice tax rounding discrepancy") avec des montants tres faibles (0,01 EUR, 0,08 EUR, etc.)

Actuellement, les 67 lignes d'arrondi TVA sont melangees avec les vraies lignes d'eco-contribution, faussant les totaux.

## Solution

Utiliser le seuil de 0,1381 EUR comme critere de dissociation :
- `ABS(amount) >= 0.1381` : eco-contribution
- `ABS(amount) < 0.1381` : arrondi TVA (nouvelle categorie `tax_rounding`)

## Modifications

### 1. Migration SQL

Reclassifier les 67 lignes existantes :

```sql
UPDATE payout_adjustments
SET category = 'tax_rounding'
WHERE category = 'eco_contribution'
  AND ABS(amount) < 0.1381;
```

### 2. Edge Function `parse-payment-report`

Modifier la logique de categorisation pour que les futures importations appliquent automatiquement le seuil :

- Si description = "Autres frais" ET pas de marketing adjustment :
  - Si `ABS(montant) >= 0.1381` : categorie = `eco_contribution`
  - Si `ABS(montant) < 0.1381` : categorie = `tax_rounding`

### 3. Aucun changement UI necessaire

Le dashboard eco-contribution filtre deja sur `category = 'eco_contribution'`, donc les lignes reclassifiees en `tax_rounding` disparaitront automatiquement de la vue.

## Impact

| Avant | Apres |
|-------|-------|
| 2038 lignes eco-contribution | 1971 lignes eco-contribution |
| 67 lignes parasites incluses | 67 lignes reclassees en `tax_rounding` |
| Totaux fausses par des centimes | Totaux precis |

## Detail technique

| Fichier / Outil | Modification |
|-----------------|-------------|
| Migration SQL | `UPDATE payout_adjustments SET category = 'tax_rounding' WHERE category = 'eco_contribution' AND ABS(amount) < 0.1381` |
| `supabase/functions/parse-payment-report/index.ts` | Ajouter condition sur le montant pour dissocier eco vs tax_rounding lors de l'import |
