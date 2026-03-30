

## Objectif
Isoler la liste des restaurants par marque dans `DeliverooMatching.tsx`.

## Problème
Ligne 37-43 : `supabase.from("restaurants").select("id, name, deliveroo_store_id").order("name")` — aucun filtre par marque.

## Correction

### `src/pages/DeliverooMatching.tsx`
1. Remplacer le `useQuery(["restaurants-for-deliveroo-matching"], ...)` par `useActiveRestaurants()`.
2. Mapper le résultat avec `useMemo` pour conserver la structure `{ id, name, deliveroo_store_id }` attendue par le composant.
3. Le champ `deliveroo_store_id` n'est pas dans `useActiveRestaurants()` — il faudra soit l'ajouter au hook, soit faire une query complémentaire scopée. Recommandation : ajouter `deliveroo_store_id` au select de `useActiveRestaurants()` dans `useChainRestaurants.ts` (un seul endroit à maintenir).

### `src/hooks/useChainRestaurants.ts`
- Ajouter `deliveroo_store_id` au `.select(...)` de `useActiveRestaurants()`.

## Résultat attendu
- Le matching Deliveroo ne propose que les restaurants de la marque active.
- Aucune régression sur les autres pages utilisant `useActiveRestaurants()`.

