

# Bug : le toggle Epinglés/Réseau ne met pas a jour la data

## Diagnostic

Le problème est clair dans `Overview.tsx` :

1. **`useOverviewData`** (ligne 328) : ce hook fetche toujours TOUS les restaurants actifs en interne (ligne 391 de `useOverviewData.ts`). Il ne reçoit aucun paramètre lié à `isNetworkView`. Les KPI cards (Global, Uber Eats, Deliveroo) affichent donc toujours la data de tout le réseau, que le toggle soit sur Épinglés ou Réseau.

2. **`useNetworkStats`** (ligne 338) : ce hook reçoit toujours `pinnedIds` (ligne 339), jamais les IDs de tout le réseau. Le tableau "Comparatif" et la barre de répartition CA affichent donc toujours les restaurants épinglés, même quand on switche sur Réseau.

3. **`isNetworkView`** est bien géré en state et persisté dans localStorage, mais il n'est jamais utilisé pour conditionner les données affichées.

## Corrections

### `src/pages/Overview.tsx`

1. **Calculer les IDs selon le toggle** : créer un `useMemo` qui retourne soit `pinnedIds` soit tous les IDs actifs selon `isNetworkView` :
```typescript
const activeIds = useMemo(
  () => isNetworkView 
    ? (allActiveRestaurants?.map(r => r.id) || [])
    : pinnedIds,
  [isNetworkView, allActiveRestaurants, pinnedIds]
);
```

2. **Passer `activeIds` a `useNetworkStats`** (ligne 339) : remplacer `restaurantIds: pinnedIds` par `restaurantIds: activeIds` pour que le tableau comparatif et la barre de répartition reflètent le bon scope.

3. **Passer `activeIds` a `useOverviewData`** : ajouter un paramètre `restaurantIds` au hook pour filtrer les données des KPI cards selon le toggle.

### `src/hooks/useOverviewData.ts`

4. **Accepter un paramètre `filterRestaurantIds`** optionnel dans la signature de `useOverviewData`. Si fourni, utiliser ces IDs au lieu de tous les IDs actifs pour les sous-requêtes (sales, reviews, etc.). Cela permet aux 3 cards (Global, Uber, Deliveroo) de refléter le bon périmètre.

### Fichiers modifiés
- `src/pages/Overview.tsx` (ajouter `activeIds`, les passer aux 2 hooks)
- `src/hooks/useOverviewData.ts` (accepter et utiliser `filterRestaurantIds`)

