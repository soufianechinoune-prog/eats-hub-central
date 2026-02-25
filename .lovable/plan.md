

# Corriger les graphiques Promotions et Analyse Croisée pour Deliveroo et Global

## Problèmes identifiés

### Problème 1 : Promotions et Analyse Croisée toujours en mode Uber

Les graphiques "Évolution des Promotions" et "Analyse Croisée CA / Promos / Rentabilité" utilisent les données de `useFinancesDrilldown` (ligne 612 de `AnalyticsCharts.tsx`). Ce hook est appelé **sans le prop `platform`**, ce qui fait qu'il utilise la valeur par défaut `"uber_eats"`. Résultat : même en sélectionnant Deliveroo ou Global, ces deux graphiques affichent toujours les données Uber.

### Problème 2 : Vue Global fonctionne pour les graphiques principaux

La vue Global pour CA, Commandes et Panier Moyen fonctionne correctement car `globalRevenueData` combine bien `uberRevenueData` et `deliverooRevenueData` (lignes 1207-1209 de `Analytics.tsx`). Ce n'est pas un bug.

## Correction

### Fichier : `src/components/analytics/AnalyticsCharts.tsx`

**Passer `platform: selectedPlatform` au hook `useFinancesDrilldown`** (lignes 612 et 621)

```typescript
// Ligne 612 — données période courante
const { dailyData: revenueProfitabilityData, isLoading: isProfitabilityLoading } = useFinancesDrilldown({
  restaurantIds,
  startDate: profitStartDate,
  endDate: profitEndDate,
  granularity: 'daily',
  enabled: viewMode === 'revenue' && restaurantIds.length > 0,
  platform: selectedPlatform,  // ← AJOUT
});

// Ligne 621 — données N-1
const { dailyData: revenueProfitabilityPrevData, isLoading: isProfitabilityPrevLoading } = useFinancesDrilldown({
  restaurantIds,
  startDate: profitPrevStartDate,
  endDate: profitPrevEndDate,
  granularity: 'daily',
  enabled: viewMode === 'revenue' && restaurantIds.length > 0,
  platform: selectedPlatform,  // ← AJOUT
});
```

Le hook `useFinancesDrilldown` supporte déjà les trois valeurs (`"uber_eats"`, `"deliveroo"`, `"global"`) — il fetch les données de la bonne source selon la plateforme (lignes 484-494 du hook). Aucune modification du hook nécessaire.

### Résultat

- Onglet **Deliveroo** : les graphiques Promotions et Analyse Croisée afficheront les contributions marketing Deliveroo
- Onglet **Global** : ces graphiques combineront les données Uber + Deliveroo
- Onglet **Uber Eats** : comportement inchangé

### Fichier modifié
- `src/components/analytics/AnalyticsCharts.tsx` (2 lignes ajoutées)

