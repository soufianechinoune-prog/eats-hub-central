

## Diagnostic

L'erreur dans la console est claire :

```
get_profitability_daily prev error: { code: "57014", message: "canceling statement due to statement timeout" }
```

La requête N-1 (2024) **timeout** car elle scanne ~1,2M de commandes avec un plan d'exécution sous-optimal (BitmapAnd entre 2 index séparés au lieu d'un seul index composite).

**Cause racine** : il n'y a pas d'index `(restaurant_id, order_datetime)` sur la table `orders` (2,8M lignes). L'index existant est inversé : `(order_datetime, restaurant_id)`, ce qui force PostgreSQL à faire un BitmapAnd coûteux.

## Plan

**1. Créer l'index composite optimisé**

```sql
CREATE INDEX CONCURRENTLY idx_orders_restaurant_datetime 
ON public.orders (restaurant_id, order_datetime);
```

Cet index permet à PostgreSQL d'utiliser un Index Scan direct sur `restaurant_id = ANY(...)` + plage `order_datetime`, éliminant le BitmapAnd.

**2. Aucune modification de code nécessaire**

La RPC `get_profitability_daily` et le code front (`Analytics.tsx`) restent inchangés — seule la performance de la requête s'améliore.

**Résultat attendu** : la requête passe de timeout (~30s+) à <2s grâce au scan direct sur l'index composite.

