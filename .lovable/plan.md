## Bug identifié

Tu as raison : pour Argenteuil en Janvier 2026, le concurrent **Chicken Street - Argenteuil** existe bien et a des données ce mois-ci. Test direct de la fonction côté base :

```
RPC get_restaurant_local_benchmark(Tasty Argenteuil, 2026-01-01, 2026-01-31)
→ competitor_count: 1, match_level: 'city', avg_conversion_rate: 4.38%
```

→ **La base répond correctement, le bug est côté frontend.**

## Cause racine

Dans `src/components/analytics/AnalyticsCharts.tsx` (ligne 3351), le composant `<ConversionScatterPlot>` est appelé **sans les props `startDate` et `endDate`** :

```tsx
<ConversionScatterPlot 
  data={perRestaurantData}
  highlightedRestaurants={selectedRestaurants}
  // ❌ startDate et endDate manquants
/>
```

Conséquence : la requête interne du benchmark a `enabled: !!selectedRestaurantId && !!startDate && !!endDate` → `false` → la requête ne part jamais → `benchmark = null` → message "Aucun concurrent local trouvé" affiché systématiquement.

## Correction

Passer `chartDateRange.startDate` et `chartDateRange.endDate` (déjà calculées plus haut dans le même composant, ligne 1938) au `<ConversionScatterPlot>` :

```tsx
<ConversionScatterPlot 
  data={perRestaurantData}
  highlightedRestaurants={selectedRestaurants}
  startDate={chartDateRange.startDate}
  endDate={chartDateRange.endDate}
/>
```

C'est un fix d'**une seule ligne**, pas de migration SQL nécessaire.

## Résultat attendu

Cliquer sur **TASTY CROUSTY ARGENTEUIL** en janvier 2026 affichera :
- un point gris "Moyenne concurrents" sur le graphique à ~4.38% de conversion
- la carte de comparaison avec le delta vs ta performance et la mention "ARGENTEUIL · 1 concurrent"