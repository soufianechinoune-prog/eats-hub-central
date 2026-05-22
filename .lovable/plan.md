## Problème

Quand on clique sur un mois, le tableau du haut (Rentabilité Comparée) met très longtemps à apparaître. Idem en vue année, mais en pire.

## Cause racine (2 bugs cumulés)

### 1. Boucle de pagination qui ré-exécute la RPC complète

Dans `src/pages/Analytics.tsx` (lignes 388-419), le code appelle `get_orders_finance_detail` **jusqu'à 50 fois** via `.range(from, from + 999)` pour paginer :

```ts
for (let i = 0; i < 50; i++) {
  const { data } = await supabase
    .rpc('get_orders_finance_detail', { p_year, p_month, p_restaurant_ids })
    .range(from, from + 1000 - 1);   // ⚠️ relance toute la RPC à chaque page
  ...
}
```

PostgREST + Supabase **ré-exécute la fonction entière à chaque appel** (le `.range()` ne fait qu'un `LIMIT/OFFSET` sur le résultat final). La RPC scanne ~30 restos × 31 jours dans `orders` à chaque itération.

Comme la RPC retourne ~1 ligne par (resto × jour) = ~1000 lignes/mois, on est **pile au seuil** où la boucle fait 2 passages (≈ 2 fois plus lent que nécessaire). En vue année (si appelée), on parle de × N passages.

### 2. RPC `get_orders_finance_detail` non optimisée pour l'index

La RPC actuelle fait un `GROUP BY o.restaurant_id, payout_date` direct sur `orders`. Le planner choisit parfois un scan global au lieu d'utiliser `idx_orders_restaurant_datetime`.

La sœur RPC `get_orders_finance_summary` utilise déjà le pattern optimal :
```sql
FROM unnest(v_ids) AS ids(restaurant_id)
CROSS JOIN LATERAL (
  SELECT ... FROM orders o
  WHERE o.restaurant_id = ids.restaurant_id
    AND o.order_datetime >= v_start AND o.order_datetime < v_end
) ord
```
→ force un index-scan par resto, beaucoup plus rapide.

## Correctif

### A. Backend — réécrire `get_orders_finance_detail`

Migration SQL :
- Garder la même signature (29 colonnes retournées, dont les 3 nouveaux champs `refund_to_customer` / `refund_uber_cancellation` / `refund_net`)
- Adopter le pattern `unnest(v_ids) CROSS JOIN LATERAL` comme `get_orders_finance_summary`
- Ajouter `SET statement_timeout TO '45s'`
- Résoudre les IDs (RLS) **une seule fois** au début, pas dans la `WHERE`

### B. Frontend — supprimer la boucle de pagination

`src/pages/Analytics.tsx` (388-419) : remplacer la boucle `for (let i = 0; i < 50; ...)` par **un seul appel**. Avec la RPC corrigée et un index-scan, ~1000 lignes/mois passent sans souci sous le cap PostgREST si on n'utilise pas `.range()`.

Si jamais il faut > 1000 lignes (grosse marque), passer par un `.range(0, 9999)` unique au lieu d'une boucle (PostgREST accepte jusqu'à `max-rows` configuré, ou on étend la RPC pour paginer côté SQL).

### C. Aucune modif UI

Le composant `ProfitabilityComparisonTable` continue à recevoir le même `payouts={dailyPayoutsData}` (déjà les 3 colonnes Remb. clients / Annulations Uber / Net).

## Impact attendu

- Drilldown mois : passage de ~plusieurs secondes à **< 1s** (1 RPC indexée vs 2-50 RPCs full-scan).
- Pas de régression fonctionnelle.

## Hors scope (à voir plus tard)

- Vue année (sans drilldown) : nécessite de brancher `get_yearly_payouts_detail` sur `dailyPayoutsData`. Je peux le faire dans un second temps si tu veux que le tableau soit aussi visible en vue année.
