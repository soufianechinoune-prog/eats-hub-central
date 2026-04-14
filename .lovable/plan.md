

# Fix: Pas de données sur Revenus & Ventes

## Problème identifié
Les logs console montrent que `restaurantFilter` vaut `["00000000-0000-0000-0000-000000000000"]` — un UUID fictif qui ne correspond à aucun restaurant. Cela se produit quand la liste des restaurants n'a pas encore fini de charger au moment où la requête de revenus se lance.

La fonction `resolveBrandScopedRestaurantIds` retourne ce UUID "vide" quand `selectedChainId` est défini mais `chainRestaurantIds` est encore `[]` (chargement en cours). La requête RPC part donc avec un filtre qui ne matche rien → 0 résultats.

## Solution

**Fichier** : `src/pages/Analytics.tsx`

1. **Ajouter une garde sur `enabled`** : les requêtes de revenus (et comparaisons) ne doivent se lancer que quand `restaurantFilter` n'est pas le tableau "vide" dummy :

```tsx
const isRestaurantScopeReady = !restaurantFilter || 
  restaurantFilter !== EMPTY_BRAND_SCOPE_RESTAURANT_IDS;
```

2. **Modifier les `enabled` des queries revenue** (current, previous year, rolling, deliveroo) pour inclure cette condition :

```tsx
enabled: needsRevenue && isRestaurantScopeReady,
```

Cela empêche les requêtes de partir avec le UUID fictif. Dès que les restaurants sont chargés, `restaurantFilter` sera mis à jour avec les vrais IDs et les requêtes se lanceront automatiquement.

3. **Import** : ajouter `EMPTY_BRAND_SCOPE_RESTAURANT_IDS` depuis `@/lib/brandScope` (même pattern que `Dashboard.tsx`).

