

# Corriger l'affichage Eco-contribution et Pub dans le tableau de Rentabilite

## Diagnostic

### Eco-contribution : donnee manquante dans la RPC
- **821 versements** dans la table `payouts` contiennent une valeur `eco_contribution_refund` non nulle (total: 119 041 EUR)
- La fonction SQL `get_monthly_payouts_detail` ne retourne PAS cette colonne -- elle est simplement absente du SELECT
- Consequence : en vue "Mois" (drill-down), eco_contribution = 0 pour toutes les lignes

### Pub (advertising) : agrégation manquante en vue "Mois"
- **1 816 lignes** dans `payout_adjustments` (total: -330 233 EUR)
- La requete Analytics.tsx les recupere correctement depuis `payout_adjustments`
- En vue "Rentabilite" (par versement), `advertisingAmount` est bien calcule via `adMap`
- En vue "Mois", l'agregation par restaurant (`restaurantAggregates`) n'accumule PAS `advertisingAmount`
- Le header mensuel non plus ne totalise pas la pub
- En janvier 2026, seuls 2-3 restaurants ont de la pub (les "-" sont donc normaux pour les autres)

## Corrections

### 1. Migration SQL : ajouter eco_contribution_refund a la RPC

Modifier la fonction `get_monthly_payouts_detail` pour inclure `COALESCE(p.eco_contribution_refund, 0) as eco_contribution_refund` dans le SELECT et dans le type de retour.

### 2. Agreger la pub dans la vue "Mois" (ProfitabilityComparisonTable.tsx)

Dans le `monthGroups` useMemo :
- Ajouter `advertisingAmount` dans `restaurantAggregates` (initialisation a 0, accumulation depuis `row.advertisingAmount`)
- Passer `advertisingAmount` dans `MonthRestaurantData`
- Calculer le `totalAdvertising` au niveau du mois (header)
- Afficher les valeurs dans les cellules du tableau (vue Mois)

### 3. Verifier la vue "Semaine"

Meme verification pour la vue "Semaine" : s'assurer que `advertisingAmount` et `ecoContribution` sont correctement agreges et affiches.

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| Migration SQL | Ajouter `eco_contribution_refund` au SELECT et au RETURN TYPE de `get_monthly_payouts_detail` |
| `src/components/analytics/ProfitabilityComparisonTable.tsx` | Agreger `advertisingAmount` dans les vues Mois et Semaine ; afficher dans les cellules |

## Resultat attendu

- La colonne "Eco-contrib." affichera les vrais montants (ex: ~44 EUR pour certains restaurants en janvier 2026)
- La colonne "Pub" affichera les depenses pour les restaurants concernes (ex: restaurant 4e35... avec ~42 EUR/semaine)
- Les restaurants sans pub resteront a "-" (comportement correct)

