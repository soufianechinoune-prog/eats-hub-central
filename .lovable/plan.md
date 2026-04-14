

# Fix: isLoading bloque l'affichage sur l'onglet Revenus

## Problème
Ligne 1161 de `Analytics.tsx`, `isLoading` inclut `loadingUberConversion` et `loadingDeliverooConversion` même quand `needsConversion = false` (ex: on est sur l'onglet "revenue"). Les queries désactivées (`enabled: false`) peuvent rester en état "loading" indéfiniment → l'UI affiche le spinner infini au lieu des graphiques.

## Solution

### Fichier : `src/pages/Analytics.tsx` (ligne 1161-1162)

Remplacer :
```tsx
const isLoading = loadingUberRevenue || loadingUberConversion || loadingUberFees ||
                  loadingDeliverooRevenue || loadingDeliverooConversion || loadingDeliverooFees;
```

Par :
```tsx
const isLoading = (() => {
  if (viewMode === 'revenue') {
    return loadingUberRevenue || loadingDeliverooRevenue ||
           loadingUberFees || loadingDeliverooFees;
  }
  if (viewMode === 'conversion') {
    return loadingUberConversion || loadingDeliverooConversion;
  }
  if (viewMode === 'finances') {
    return loadingUberRevenue || loadingDeliverooRevenue;
  }
  // overview: all
  return loadingUberRevenue || loadingUberConversion ||
         loadingUberFees || loadingDeliverooRevenue ||
         loadingDeliverooConversion || loadingDeliverooFees;
})();
```

Changement unique, 1 fichier, 2 lignes remplacées par 15.

