## Objectif
Remplir la colonne `orders.data_source` (actuellement `NULL` sur 2 708 249 commandes / 93 restaurants) en utilisant la fonction SQL existante `backfill_orders_data_source_for_restaurant(uuid)` déjà déployée.

## État actuel (vérifié à l'instant)
- `uber_api` : 1 714 259 orders (déjà marquées sur les imports passés)
- `csv_import` : 279 454 orders
- **`NULL` : 2 708 249 orders → 93 restaurants à traiter**
- 165 restaurants ont au moins un job backfill `done`

## Logique de la fonction (rappel)
Pour un `restaurant_id` donné :
1. Marque `data_source = 'uber_api'` toutes les `orders` qui tombent dans une plage `[month_start, month_end]` d'un `backfill_jobs.status='done'` du même restaurant.
2. Marque le reste des `orders NULL` de ce restaurant comme `'csv_import'`.

## Étapes
### 1. Lancer le backfill par batch (via supabase--insert)
Boucle SQL côté serveur sur les 93 restaurants ayant des `orders` NULL. On exécute la fonction restaurant par restaurant pour éviter un UPDATE massif en une seule transaction (2,7M lignes) qui pourrait timeout :

```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT restaurant_id
    FROM orders
    WHERE data_source IS NULL
  LOOP
    PERFORM public.backfill_orders_data_source_for_restaurant(r.restaurant_id);
  END LOOP;
END $$;
```

Si timeout statement (> 2 min), on découpe en 3-4 sous-batches manuels (≈ 25 restos par appel).

### 2. Vérification post-backfill
Re-query :
```sql
SELECT data_source, COUNT(*) FROM orders GROUP BY data_source;
```
On doit voir `NULL = 0`.

## Hors scope (Phase 2)
- Patch des edge functions Uber/CSV pour écrire `data_source` à l'insert (le worker continue à tourner sans).
- Composant `<DataSourceBadge>` dans `RestaurantComparisonTable`.
- Toggle global ON/OFF dans Overview.

## Risque
- Aucun impact sur le worker Uber en cours (il écrit dans `backfill_jobs` et le webhook insère dans `orders` — la fonction lit en SELECT et fait un UPDATE par restaurant).
- Si timeout : on relance par sous-batches, idempotent (la fonction filtre `data_source IS NULL`).