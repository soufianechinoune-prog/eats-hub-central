
# Fix : Filtrage des restaurants par dates d'activité

## Probleme identifie

Le filtre `filterActiveRestaurants` dans `src/lib/restaurantActivityFilter.ts` considere qu'un restaurant sans dates Deliveroo (null) est "actif sur Deliveroo depuis toujours". Resultat : 24 restaurants qui n'ont jamais ete sur Deliveroo passent le filtre meme pour des periodes anterieures a leur ouverture Uber.

Exemple : Villeneuve la Garenne (ouverture Uber le 24/03/2025, pas de dates Deliveroo) apparait en fevrier 2024.

## Solution

Modifier la fonction `isActiveForPeriod` pour qu'un restaurant sans aucune date sur une plateforme soit considere comme **inactif** sur cette plateforme (et non actif par defaut).

La nouvelle logique :
- Une plateforme est "configuree" si elle a au moins une date (ouverture OU fermeture)
- Si une plateforme n'est pas configuree, elle est ignoree (pas consideree active)
- Si aucune plateforme n'est configuree, le restaurant est considere toujours actif (retrocompatibilite)

## Details techniques

### Fichier : `src/lib/restaurantActivityFilter.ts`

Modifier la fonction `isActiveForPeriod` :

```typescript
function isActiveForPeriod(
  restaurant: RestaurantWithDates,
  startDate: Date,
  endDate: Date
): boolean {
  const startStr = formatDateLocal(startDate);
  const endStr = formatDateLocal(endDate);

  const uberConfigured = !!restaurant.uber_opening_date || !!restaurant.uber_closing_date;
  const deliverooConfigured = !!restaurant.deliveroo_opening_date || !!restaurant.deliveroo_closing_date;

  // If no platform is configured at all, consider always active (backward compat)
  if (!uberConfigured && !deliverooConfigured) return true;

  const uberActive = uberConfigured &&
    (!restaurant.uber_opening_date || restaurant.uber_opening_date <= endStr) &&
    (!restaurant.uber_closing_date || restaurant.uber_closing_date >= startStr);

  const deliverooActive = deliverooConfigured &&
    (!restaurant.deliveroo_opening_date || restaurant.deliveroo_opening_date <= endStr) &&
    (!restaurant.deliveroo_closing_date || restaurant.deliveroo_closing_date >= startStr);

  return uberActive || deliverooActive;
}
```

Ce changement s'applique globalement a toutes les pages qui utilisent `filterActiveRestaurants` (Downtime, Prep Time, Ratings, Overview, etc.), corrigeant le filtrage partout en une seule modification.
