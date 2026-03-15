

## Fix: "restaurants suivis" count not updating on toggle

### Root Cause

In `useOverviewData.ts` (line 422), `restos = restaurants.data` always returns **all** active restaurants from `useOverviewRestaurants()`, regardless of the `filterRestaurantIds` parameter. So `totalRestaurants: restos.length` always shows the full network count (e.g. 14) even when toggling to Réseau (91) or vice versa.

### Fix (1 file)

**`src/hooks/useOverviewData.ts`** — line 422: filter `restaurants.data` to only include restaurants matching `filterRestaurantIds` (the `activeIds` passed from Overview):

```typescript
const restos = filterRestaurantIds && filterRestaurantIds.length > 0
  ? restaurants.data.filter(r => filterRestaurantIds.includes(r.id))
  : restaurants.data;
```

This requires passing `filterRestaurantIds` into the `computedData` closure, which already has access since it's defined in the same scope.

The `totalRestaurants` count and all per-restaurant metrics will then correctly reflect the active toggle state (Épinglés vs Réseau).

