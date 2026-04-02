

## Objectif
Supprimer les vagues séquentielles inutiles dans `useOverviewData.ts` pour que toutes les requêtes partent en parallèle dès que les `restaurantIds` sont disponibles.

## Diagnostic réel
Le code actuel impose 4 vagues séquentielles via `enabled` :
- Wave 1 : sales, payouts, deliveroo → `enabled: hasIds` ✅
- Wave 2 : reviews, accuracy, errors → `enabled: hasIds && !!sales.data` ❌ inutile
- Wave 3 : prepTimes, availability → `enabled: wave1Done && !!reviews.data` ❌ inutile  
- Wave 4 : products, conversion → `enabled: wave2Done && !!prepTimes.data` ❌ inutile

Aucune de ces requêtes ne dépend du **résultat** d'une autre — elles dépendent toutes uniquement des `restaurantIds`.

## Modification unique : `src/hooks/useOverviewData.ts`

**Lignes 393-412** — Remplacer les conditions `enabled` des waves 2, 3 et 4 par simplement `hasIds` :

```typescript
// Toutes les requêtes partent en parallèle dès que les IDs sont disponibles
const sales = useOverviewSales(restaurantIds, startDateStr, endDateStr, hasIds);
const payouts = useOverviewPayouts(restaurantIds, startDateStr, endDateStr, hasIds);
const deliverooSales = useOverviewDeliverooSales(restaurantIds, startDateStr, endDateStr, hasIds);
const reviews = useOverviewReviews(restaurantIds, startDateStr, endDateStr, hasIds);
const accuracy = useOverviewAccuracy(restaurantIds, startDateStr, endDateStr, hasIds);
const errors = useOverviewErrors(restaurantIds, startDate, endDate, hasIds);
const prepTimes = useOverviewPrepTimes(restaurantIds, startDate, endDate, hasIds);
const availability = useOverviewAvailability(restaurantIds, startDate, endDate, hasIds);
const products = useOverviewProducts(restaurantIds, startDate, endDate, startDateStr, endDateStr, hasIds);
const conversion = useOverviewConversion(restaurantIds, startDateStr, endDateStr, hasIds);
```

Suppression des variables `wave1Done`, `wave2Done`, `wave3Done`.

## Impact estimé
- Avant : 4 vagues séquentielles (~4× la latence d'une requête)
- Après : toutes en parallèle (~1× la latence de la requête la plus lente)
- Gain estimé : **~60-70% de réduction du temps de chargement**

## Aucune migration SQL nécessaire

