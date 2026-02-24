

# Corriger la moyenne de commission Deliveroo (24.5% au lieu de 24.0%)

## Probleme

La moyenne de commission affiche 24.5% alors que toutes les semaines individuelles sont entre 23.9% et 24.0%. C'est parce que le calcul de la moyenne (ligne 618) utilise toujours `netSales` (CA - promos) comme denominateur, meme pour Deliveroo. Comme les promos Deliveroo sont des credits (pas des deductions du CA), cela reduit artificiellement le denominateur et gonfle le taux moyen.

Le fix applique aux lignes individuelles (ligne 309) n'a pas ete replique dans le bloc des moyennes.

## Correction

### Fichier : `src/components/analytics/ProfitabilityComparisonTable.tsx`

**Ligne 618** : Appliquer la meme logique platform-aware que pour les lignes individuelles.

```
// Avant (bug) :
const avgUberRate = netSales > 0 ? (totalUberFeeHT / netSales) * 100 : 0;

// Apres (fix) :
const avgRateDenominator = platform === "deliveroo" ? totalSales : netSales;
const avgUberRate = avgRateDenominator > 0 ? (totalUberFeeHT / avgRateDenominator) * 100 : 0;
```

Aucun autre fichier a modifier.

