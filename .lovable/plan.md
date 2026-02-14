
# Corriger les 393 lignes ignorees (Restaurant not found)

## Diagnostic

Les 393 lignes ignorees proviennent de commandes dont le `store_id` dans le CSV correspond a un identifiant secondaire/historique stocke dans la table `restaurant_uber_ids`, mais la fonction ne consulte que `restaurants.uber_store_id`. Les restaurants ayant change d'UUID (ex: Montreuil, Saint-Etienne, Colombes, Arras, Meaux, Melun, etc.) ne sont pas retrouves.

De plus, si le store ID n'est pas trouve et que le fallback par nom echoue aussi (la colonne "restaurant" dans le CSV est peut-etre vide ou nommee differemment), les lignes sont ignorees avec un message "Restaurant not found" sans detail.

## Solution

### Fichier : `supabase/functions/parse-inaccurate-orders/index.ts`

**1. Charger les identifiants secondaires depuis `restaurant_uber_ids`**

En plus de la requete actuelle sur `restaurants`, ajouter une requete sur `restaurant_uber_ids` pour construire un map complet de tous les UUID connus :

```text
// Requete supplementaire
const { data: uberIds } = await supabase
  .from('restaurant_uber_ids')
  .select('uber_store_id, restaurant_id');

// Ajouter au map existant
for (const mapping of uberIds || []) {
  const restaurant = restaurants?.find(r => r.id === mapping.restaurant_id);
  if (restaurant && !restaurantByStoreId.has(mapping.uber_store_id)) {
    restaurantByStoreId.set(mapping.uber_store_id, { id: restaurant.id, name: restaurant.name });
  }
}
```

**2. Ajouter des variantes de noms de colonnes pour le restaurant**

Le CSV pourrait utiliser "nom du restaurant", "store name", etc. Ajouter ces variantes dans le `getCol` pour le nom :

```text
const restaurantName = getCol(row, 'restaurant', 'nom du restaurant', 'store name', 'restaurant name');
```

**3. Ameliorer le detail des erreurs**

Inclure aussi le store ID qui a echoue dans le message d'erreur pour faciliter le debug :

```text
details: `Restaurant not found: name="${restaurantName}" storeId="${storeId}"`
```

## Impact attendu

Les 393 lignes correspondent tres probablement a 1-2 restaurants dont les UUID historiques sont dans `restaurant_uber_ids`. Apres ce changement, ces lignes seront correctement rattachees et importees.
