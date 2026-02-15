

# Corriger le matching "Chicken Street - Lille" - Approche directe

## Diagnostic

Le code dans `findRestaurantByPartialName` est correct (hardcoded match + ambiguous match), mais les deploiements successifs ne semblent pas prendre effet (0 logs dans les logs de la fonction).

La solution : deplacer le matching directement dans le flux principal de la fonction, AVANT l'appel a `findRestaurantByPartialName`, pour eliminer toute dependance a cette sous-fonction.

## Changement

**Fichier** : `supabase/functions/parse-inaccurate-orders/index.ts`

Ajouter un mapping direct dans le flux principal (lignes 327-335), juste apres l'echec du match exact par nom normalise et AVANT l'appel a `findRestaurantByPartialName` :

```text
// Fallback to name matching
if (!matchedRestaurant) {
  const restaurantName = getCol(row, 'restaurant', 'nom du restaurant', 'store name', 'restaurant name');
  if (restaurantName) {
    const normalizedName = normalizeRestaurantName(restaurantName);
    matchedRestaurant = restaurantByName.get(normalizedName);

    // NEW: Direct hardcoded match for ambiguous names
    if (!matchedRestaurant) {
      const cleanName = restaurantName.toLowerCase().trim().replace(/\s+/g, ' ');
      if (cleanName === 'chicken street - lille') {
        matchedRestaurant = restaurants?.find(r => r.id === 'b81531ef-d5db-47dd-b0bb-37f2c9fd6d5d');
        if (matchedRestaurant) {
          console.log(`Direct hardcoded match: "${restaurantName}" -> Lille Wazemmes`);
        }
      }
    }

    if (!matchedRestaurant) {
      matchedRestaurant = findRestaurantByPartialName(restaurantName, restaurantByName) || undefined;
    }
  }
}
```

De plus, ajouter un `console.log` avec un numero de version en haut de la fonction pour confirmer que le deploiement est bien actif :

```text
console.log(`[parse-inaccurate-orders v3] dryRun=${dryRun}, restaurantId=${restaurantId || 'none'}`);
```

## Pourquoi cette approche

- Le match se fait directement dans le flux principal, pas dans une sous-fonction
- On utilise `restaurants` (le tableau brut de la requete DB) plutot que `restaurantByName` (la Map), ce qui elimine tout probleme de cle
- Le log de version permet de verifier que le bon code est deploye

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/parse-inaccurate-orders/index.ts` | Ajouter match direct dans le flux principal + log de version |

