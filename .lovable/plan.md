
# Afficher les restaurants épinglés en premier dans le sélecteur

## Contexte
Le composant `RestaurantSelector` utilisé dans l'onglet "Prix Restaurants" (et "Rentabilité") affiche actuellement tous les restaurants dans un seul groupe non trié. L'utilisateur souhaite que les restaurants épinglés apparaissent en premier, comme c'est déjà le cas dans l'Analytics Header.

## Solution
Modifier le composant `RestaurantSelector` pour :
1. Ajouter la propriété `is_pinned` à l'interface `Restaurant`
2. Séparer les restaurants en deux groupes : "⭐ Épinglés" et "Autres restaurants"
3. Ajouter une option "Sélectionner les épinglés" si des restaurants sont épinglés

## Changement technique

**Fichier : `src/components/menu/RestaurantSelector.tsx`**

### Avant
```
Liste plate de tous les restaurants
```

### Après
```
- 📍 Section "⭐ Épinglés (4)" avec les 4 restaurants prioritaires
- 📍 Section "Autres restaurants" avec le reste
```

### Modifications détaillées

1. **Mettre à jour l'interface Restaurant** :
```typescript
interface Restaurant {
  id: string;
  name: string;
  is_pinned?: boolean;  // Ajouter cette propriété
}
```

2. **Séparer les restaurants en deux listes** :
```typescript
const pinnedRestaurants = restaurants.filter(r => r.is_pinned);
const unpinnedRestaurants = restaurants.filter(r => !r.is_pinned);
```

3. **Ajouter un bouton "Sélectionner les épinglés"** dans le dropdown :
```typescript
{pinnedRestaurants.length > 0 && (
  <CommandItem onSelect={selectAllPinned}>
    <Star className="mr-2 h-4 w-4 fill-amber-500 text-amber-500" />
    <span>Sélectionner les {pinnedRestaurants.length} épinglés</span>
  </CommandItem>
)}
```

4. **Afficher deux CommandGroup distincts** :
   - "⭐ Épinglés (4)" pour les restaurants avec `is_pinned = true`
   - "Autres restaurants" pour les autres

5. **Mettre à jour les composants parents** pour passer `is_pinned` dans les données restaurants :
   - `InterRestaurantComparison.tsx` (onglet Prix Restaurants)
   - `ProfitabilityComparison.tsx` (onglet Rentabilité)

## Résultat attendu

| Avant | Après |
|-------|-------|
| Liste non triée de tous les restaurants | ⭐ Sélectionner les 4 épinglés |
| | ⭐ Épinglés (4) |
| | - CHICKEN STREET ANTONY |
| | - CHICKEN STREET ATHIS-MONS |
| | - CHICKEN STREET BONNEUIL |
| | - CHICKEN STREET JUVISY |
| | Autres restaurants |
| | - CHICKEN STREET AMIENS... |
| | - CHICKEN STREET ANGERS... |
