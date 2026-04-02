

## Objectif
Ajouter une pagination `PAGE_SIZE = 1000` sur les requêtes directes à la table `orders` dans 2 hooks (les 2 autres n'en ont pas besoin).

## Analyse

| Hook | Requête directe sur orders? | Pagination nécessaire? |
|---|---|---|
| useNetworkStats.ts | Non — utilise des RPCs agrégées | ❌ |
| useOfferProfitability.ts | Oui (ligne 222, `.from("orders").select(...)`) | ✅ |
| useItemSalesAnalytics.ts | Oui (2 requêtes `.from("orders").select("id")`) | ✅ |
| useOfferMatchedOrders.ts | Oui mais `.limit(150)` intentionnel | ❌ |

## Modifications (2 fichiers)

### 1. `src/hooks/useOfferProfitability.ts` (lignes 222-234)

Remplacer la requête simple par une boucle paginée :

```typescript
const PAGE_SIZE = 1000;
let allOrders: any[] = [];
let from = 0;
let hasMore = true;

while (hasMore) {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      sales_incl_vat,
      uber_fee_after_promo_incl_vat,
      item_promo_incl_vat,
      refund_incl_vat,
      net_payout,
      meal_voucher_amount
    `)
    .in("restaurant_id", offer.restaurant_ids)
    .gte("order_datetime", offer.start_date)
    .lt("order_datetime", endDatePlusOne.toISOString().split('T')[0])
    .range(from, from + PAGE_SIZE - 1);

  if (error) { /* error handling existant */ }
  allOrders.push(...(data || []));
  hasMore = (data?.length ?? 0) === PAGE_SIZE;
  from += PAGE_SIZE;
}
// Remplacer `const orders = data || []` par `const orders = allOrders`
```

### 2. `src/hooks/useItemSalesAnalytics.ts` — 2 requêtes orders

**Requête 1** (ligne ~55, fetch order IDs) : Remplacer par boucle paginée sur `.from("orders").select("id")`.

**Requête 2** (ligne ~155, fetch order IDs + dates pour évolution) : Remplacer par boucle paginée sur `.from("orders").select("id, order_datetime")`.

Pattern identique pour les deux :
```typescript
const PAGE_SIZE = 1000;
let allOrders: any[] = [];
let from = 0;
let hasMore = true;

while (hasMore) {
  const { data, error } = await supabase
    .from("orders")
    .select("id")  // ou "id, order_datetime"
    .gte("order_datetime", startStr)
    .lte("order_datetime", endStr + "T23:59:59")
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw error;
  allOrders.push(...(data || []));
  hasMore = (data?.length ?? 0) === PAGE_SIZE;
  from += PAGE_SIZE;
}
```

## Hooks exclus (justification)
- **useNetworkStats.ts** : Aucune requête directe sur orders — uniquement des RPCs qui retournent des agrégats (1 ligne par restaurant)
- **useOfferMatchedOrders.ts** : `.limit(150)` intentionnel pour l'affichage détail d'une offre

## Aucune migration SQL nécessaire

