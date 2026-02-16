

# Corriger la categorisation : separer eco-contribution vs ajustement marketing

## Probleme identifie

Quand une ligne sans commande a la description "Autres frais", le parser la categorise automatiquement comme `eco_contribution` (car "autres frais" matche le mot-cle). Mais en realite, certaines de ces lignes sont des **ajustements marketing** : leur montant provient de la colonne CSV "Ajustement marketing (TVA incluse)" et non de "Autres paiements".

**Chiffres** : sur 2295 lignes `eco_contribution`, **257 sont en realite des ajustements marketing** (colonne "Ajustement marketing" non nulle).

**Regle de distinction** :
- Si la colonne "Ajustement marketing (TVA incluse)" a une valeur non nulle --> c'est un `marketing_adjustment`
- Si cette colonne est vide ou 0 --> c'est bien une `eco_contribution`

## Modifications

### 1. Edge Function : `supabase/functions/parse-payment-report/index.ts`

Modifier la logique de categorisation des lignes sans commande (lignes ~494-566) :

- **Lire la valeur** de la colonne "Ajustement marketing (TVA incluse)" via `getValue('marketing_fee_adjustment')`
- **Ajouter une condition** : si `marketing_fee_adjustment != 0`, la ligne n'est PAS eco_contribution meme si la description dit "Autres frais"
- **Mettre a jour `categorizeAdjustment`** pour accepter un parametre optionnel `marketingAmount` : si non nul, retourner `'marketing_adjustment'` avant de tester les mots-cles eco
- **Exclure ces lignes** de l'accumulation `ecoContributionByPayout` (qui met a jour les colonnes eco sur la table payouts)

### 2. Migration SQL : corriger les donnees existantes

Mettre a jour les 257 lignes deja en base :

```sql
UPDATE payout_adjustments 
SET category = 'marketing_adjustment'
WHERE category = 'eco_contribution'
  AND raw_columns->>'Ajustement marketing (TVA incluse)' IS NOT NULL
  AND raw_columns->>'Ajustement marketing (TVA incluse)' != '0'
  AND raw_columns->>'Ajustement marketing (TVA incluse)' != '';
```

Puis recalculer les montants eco-contribution sur la table `payouts` pour les versements concernes (soustraire les montants marketing qui avaient ete inclus a tort).

### 3. Frontend : pas de changement necessaire

Le hook `useEcoContribution` filtre deja par `category = 'eco_contribution'`. Une fois la correction en base, les lignes marketing disparaitront automatiquement de la section eco-contribution.

## Resultat attendu

| Avant | Apres |
|-------|-------|
| 2295 lignes eco_contribution | ~2038 lignes eco_contribution |
| 257 lignes marketing melangees | 257 lignes `marketing_adjustment` separees |
| Solde eco fausse par les ajustements marketing | Solde eco propre et fiable |

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/parse-payment-report/index.ts` | Logique de categorisation enrichie avec detection colonne marketing |
| Migration SQL | Correction des 257 lignes existantes + recalcul eco sur payouts |
