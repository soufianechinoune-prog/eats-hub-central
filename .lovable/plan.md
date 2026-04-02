

## Objectif
Ajuster le `staleTime` global à 5 minutes et ajouter `staleTime: 5 * 60 * 1000` sur les hooks qui n'en ont pas encore.

## État actuel
- **App.tsx** : `staleTime: 2 * 60 * 1000`, `gcTime: 30 * 60 * 1000`, `retry: 3`, `refetchOnWindowFocus: false` — manque `refetchOnReconnect: false`, retry à changer à 2, staleTime à 5 min
- **useOfferProfitability.ts** : déjà `staleTime: 5 * 60 * 1000` ✅
- **useOfferMatchedOrders.ts** : déjà `staleTime: 5 * 60 * 1000` ✅
- **useNetworkStats.ts** : 8 useQuery, aucun staleTime ❌
- **useItemSalesAnalytics.ts** : 2 useQuery, aucun staleTime ❌
- **useOffersAnalytics.ts** : 3 useQuery, aucun staleTime ❌
- **useMarketingCampaigns.ts** : 1 useQuery, aucun staleTime ❌
- **useUberOneStats.ts** : 1 useQuery, aucun staleTime ❌

## Modifications

### 1. `src/App.tsx` (lignes 62-72)
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
```

### 2. Hooks — ajouter `staleTime: 5 * 60 * 1000` sur chaque useQuery
- **useNetworkStats.ts** : 8 useQuery (lignes ~107, 128, 150, 177, 194, 213, 243, 265)
- **useItemSalesAnalytics.ts** : 2 useQuery (lignes ~45, 172)
- **useOffersAnalytics.ts** : 3 useQuery (lignes ~81, 109, 124)
- **useMarketingCampaigns.ts** : 1 useQuery (ligne ~73)
- **useUberOneStats.ts** : 1 useQuery (ligne ~110)
- **useOfferProfitability.ts** : déjà fait, aucun changement
- **useOfferMatchedOrders.ts** : déjà fait, aucun changement

### Fichiers modifiés : 6
Aucune migration SQL.

