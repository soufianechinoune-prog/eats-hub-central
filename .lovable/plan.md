
# Correction : Temps de préparation manquant pour Athis-Mons

## Problème identifié

Le temps de préparation d'Athis-Mons n'apparaît pas dans la table "Comparatif des restaurants" sur la Vue d'ensemble, alors qu'il s'affiche correctement sur la page "Comparaison Temps de préparation".

## Cause racine

La requête `order_history` dans **deux fichiers** est limitée à **1000 lignes** (limite par défaut de l'API Supabase) au lieu de paginer correctement :

| Fichier | Problème |
|---------|----------|
| `src/pages/Overview.tsx` (ligne 302-308) | `.range(0, 50000)` mais pas de pagination |
| `src/hooks/useNetworkStats.ts` (ligne 192-198) | `.range(0, 50000)` mais pas de pagination |

**Preuve dans les logs console** :
```
Order history data: 1000 rows  ← Limité à 1000
```

Alors que les données réelles sont **1998 lignes** pour la période, dont **665 pour Athis-Mons**.

Le problème est que `.range(0, 50000)` ne contourne pas la limite de 1000 lignes de l'API REST Supabase. Une pagination explicite est nécessaire.

## Solution

Implémenter une pagination correcte comme dans `PrepTimeComparison.tsx` (qui fonctionne) :

```typescript
// Pattern de pagination à appliquer
let allOrderHistory: Array<{...}> = [];
let page = 0;
const pageSize = 1000;
let hasMore = true;

while (hasMore) {
  const { data: pageData, error } = await supabase
    .from("order_history")
    .select("restaurant_id, initial_prep_time_minutes, ...")
    .gte("order_datetime", startDate.toISOString())
    .lte("order_datetime", endDate.toISOString())
    .in("restaurant_id", restaurantIds)
    .range(page * pageSize, (page + 1) * pageSize - 1);
  
  if (error) throw error;
  
  if (pageData && pageData.length > 0) {
    allOrderHistory = [...allOrderHistory, ...pageData];
    hasMore = pageData.length === pageSize;
    page++;
  } else {
    hasMore = false;
  }
}
```

## Fichiers à modifier

### 1. `src/pages/Overview.tsx`

**Lignes 301-311** - Remplacer la requête simple par une boucle de pagination :

```typescript
// AVANT (bugué)
const { data: orderHistoryData, error: historyError } = await supabase
  .from("order_history")
  .select("...")
  .range(0, 50000);

// APRÈS (paginé)
let orderHistoryData: Array<{...}> = [];
let historyPage = 0;
let historyHasMore = true;
const PAGE_SIZE = 1000;

while (historyHasMore) {
  const { data: historyPageData, error: historyError } = await supabase
    .from("order_history")
    .select("restaurant_id, initial_prep_time_minutes, avoidable_wait_time_minutes, order_datetime, platform")
    .gte("order_datetime", startDate.toISOString())
    .lte("order_datetime", endDate.toISOString())
    .in("restaurant_id", restaurantIds)
    .order("order_datetime", { ascending: true })
    .order("restaurant_id", { ascending: true })
    .range(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE - 1);

  if (historyError) {
    console.error("Error fetching order history:", historyError);
    break;
  }

  if (historyPageData && historyPageData.length > 0) {
    orderHistoryData = [...orderHistoryData, ...historyPageData];
    historyHasMore = historyPageData.length === PAGE_SIZE;
    historyPage++;
  } else {
    historyHasMore = false;
  }
}
console.log("Order history data (paginated):", orderHistoryData.length, "rows");
```

### 2. `src/hooks/useNetworkStats.ts`

**Lignes 186-204** - Même correction pour le hook centralisé :

```typescript
// Fetch order history for prep times with pagination
const { data: orderHistoryData, isLoading: historyLoading } = useQuery({
  queryKey: ["network-stats-history", restaurantIds, startDateStr, endDateStr],
  queryFn: async () => {
    if (restaurantIds.length === 0) return [];
    
    let allData: Array<{ restaurant_id: string; initial_prep_time_minutes: number | null }> = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData, error } = await supabase
        .from("order_history")
        .select("restaurant_id, initial_prep_time_minutes")
        .gte("order_datetime", startDate.toISOString())
        .lte("order_datetime", endDate.toISOString())
        .in("restaurant_id", restaurantIds)
        .order("order_datetime", { ascending: true })
        .order("restaurant_id", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (pageData && pageData.length > 0) {
        allData = [...allData, ...pageData];
        hasMore = pageData.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    return allData;
  },
  enabled: restaurantIds.length > 0,
});
```

## Résultat attendu

| Avant | Après |
|-------|-------|
| Athis-Mons : "—" (null) | Athis-Mons : "6m 33s" |
| 1000 lignes order_history | ~1998 lignes (toutes) |

## Autres requêtes à vérifier (optionnel)

Les mêmes problèmes de pagination pourraient exister pour :
- `hourly_availability` (ligne 233-237 dans useNetworkStats)
- `order_errors` (ligne 314-320 dans Overview.tsx)

Ces requêtes utilisent aussi `.range(0, X)` sans pagination. À corriger si les volumes de données augmentent.
