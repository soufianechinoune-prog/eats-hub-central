

## Objectif
Remplacer les requêtes directes sur la table `restaurants` dans les 4 pages DataEntry par le hook `useActiveRestaurants()` qui filtre automatiquement par `selectedChainId`.

## Problème confirmé
Les 4 fichiers suivants chargent TOUS les restaurants sans filtre de marque :
- `src/pages/DataEntry.tsx` (lignes 148-158)
- `src/pages/DataEntryConversion.tsx` (lignes 103-113)
- `src/pages/DataEntryFees.tsx` (lignes 110-120)
- `src/pages/DataEntryRevenue.tsx` (lignes 103-113)

Chacun fait `supabase.from("restaurants").select("id, name, city").order("name")` — un utilisateur sur TASTY voit les restaurants Chicken Street dans le sélecteur.

## Correction (identique sur les 4 fichiers)

### Pour chaque fichier :
1. **Supprimer** l'import de `supabase` (s'il n'est plus utilisé ailleurs dans le fichier) et le `useQuery` dédié aux restaurants.
2. **Ajouter** `import { useActiveRestaurants } from "@/hooks/useChainRestaurants"`.
3. **Remplacer** le bloc `useQuery(["restaurants"], ...)` par :
   ```typescript
   const { data: activeRestaurants, isLoading: loadingRestaurants } = useActiveRestaurants();
   const restaurants = useMemo(() =>
     (activeRestaurants || []).map(r => ({ id: r.id, name: r.name, city: null as string | null })),
     [activeRestaurants]
   );
   ```
4. Le reste du code (sélecteur, `selectedRestaurant`, etc.) continue de fonctionner sans modification car la structure `{ id, name }` est conservée.

### Note sur `city`
`useActiveRestaurants()` ne sélectionne pas `city`. Deux options :
- Soit on enrichit la query dans `useActiveRestaurants()` pour inclure `city` (meilleure approche, un seul endroit à maintenir).
- Soit on met `city: null` dans le mapping (fonctionnel mais perd l'affichage ville).

**Recommandation** : enrichir `useActiveRestaurants()` dans `useChainRestaurants.ts` pour sélectionner aussi `city` — un changement d'une ligne.

## Résultat attendu
- Les sélecteurs de restaurant dans DataEntry ne montrent que les restaurants de la marque active.
- TASTY ne voit que ses propres restaurants, Chicken Street les siens.
- Scalable pour toute nouvelle marque ajoutée.

