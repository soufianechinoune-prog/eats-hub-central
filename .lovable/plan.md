
# Corriger le filtre de restaurants dans l'analyse Uber One

## Problème identifié

Quand vous cliquez sur un chip de restaurant pour le désactiver (fond gris clair), les données des sections "Répartition Clientèle", "Évolution % Uber One" et "Comportement comparé" ne changent pas. Seule la section "Comparaison par restaurant" se met à jour.

### Cause technique

Dans `UberOneAnalysis.tsx`, le code utilise `visibleRestaurants` (tous les chips affichés) au lieu de `selectedRestaurants` (chips avec fond sombre = actifs) :

```typescript
// Code actuel (lignes 61-68)
const restaurantIdsForQuery = useMemo(() => {
  if (visibleRestaurants && visibleRestaurants.length > 0) {
    return visibleRestaurants;  // ← Utilise TOUS les restaurants visibles
  }
  return selectedRestaurants;
}, [visibleRestaurants, selectedRestaurants]);
```

Cela signifie que même si vous désactivez un restaurant (clic sur le chip), ses données sont toujours incluses dans les calculs.

## Solution

Modifier la logique pour utiliser `selectedRestaurants` comme source de données principale, avec les restaurants épinglés comme fallback quand aucun restaurant n'est sélectionné.

### Fichier à modifier : `src/components/analytics/UberOneAnalysis.tsx`

Remplacer le `useMemo` actuel par :

```typescript
// Utiliser selectedRestaurants pour les calculs (chips actifs = fond sombre)
// Fallback aux restaurants épinglés si aucune sélection
const restaurantIdsForQuery = useMemo(() => {
  // Utiliser les restaurants sélectionnés (actifs)
  if (selectedRestaurants && selectedRestaurants.length > 0) {
    return selectedRestaurants;
  }
  // Si aucune sélection explicite, le hook useUberOneStats utilisera les épinglés comme fallback
  return [];
}, [selectedRestaurants]);
```

---

## Comportement après correction

| Action | Avant | Après |
|--------|-------|-------|
| 2 restaurants affichés, tous sélectionnés | Données de 2 restaurants | Données de 2 restaurants |
| Clic sur 1 chip pour désactiver | Données inchangées (2 restaurants) | Données mises à jour (1 restaurant) |
| Aucun restaurant sélectionné | Données de tous les visibles | Fallback aux restaurants épinglés |

Cela alignera le comportement de l'onglet Uber One avec les autres onglets de la plateforme, où cliquer sur un chip de restaurant filtre immédiatement les données affichées.

---

## Section technique

### Distinction `visibleRestaurants` vs `selectedRestaurants`

Le contexte Analytics gère deux listes :
- **`visibleRestaurants`** : Tous les chips affichés dans l'en-tête (peuvent être actifs ou inactifs)
- **`selectedRestaurants`** : Sous-ensemble des visibles qui sont actifs (fond sombre = inclus dans les calculs)

La section "Comparaison par restaurant" fonctionne correctement car elle utilise `byRestaurant` qui est dérivé des données déjà filtrées par `useUberOneStats`. Mais comme ce hook reçoit `visibleRestaurants`, il récupère toujours toutes les données.

### Impact sur les autres calculs

- `globalStats` : Sera recalculé avec uniquement les restaurants sélectionnés
- `evolution` : Graphique d'évolution mis à jour
- `comparison` : Table "Comportement comparé" mise à jour
- `byRestaurant` : Déjà correct (affiche le ranking des restaurants présents dans les données)
