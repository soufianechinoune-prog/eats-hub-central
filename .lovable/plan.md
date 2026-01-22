

# Corriger la navigation depuis le classement vers le restaurant cliqué

## Problème identifié

Quand tu cliques sur un restaurant dans le "Classement par rapidité" de la page Comparaison :
- **Attendu** : La page Analytics affiche les données du restaurant cliqué (ex: Bonneuil)
- **Actuel** : La page Analytics affiche toujours Athis-Mons, peu importe le restaurant cliqué

### Cause technique

Dans `PrepTimeRankingBars.tsx`, la fonction de clic utilise :
```typescript
toggleRestaurantSelection(restaurantId);  // AJOUTE à la sélection existante
```

Au lieu de :
```typescript
setSelectedRestaurants([restaurantId]);   // REMPLACE la sélection par ce seul restaurant
setVisibleRestaurants([restaurantId]);    // Met aussi à jour les restaurants visibles
```

Le localStorage est également mis à jour incorrectement (il ne change pas `selectedRestaurants`).

## Solution proposée

### Fichier à modifier : `src/components/compare/PrepTimeRankingBars.tsx`

**1. Importer les bonnes fonctions du contexte (ligne 54)**

```typescript
// AVANT
const { toggleRestaurantSelection, setPeriodMode, setDateRange: setContextDateRange } = useAnalyticsContext();

// APRÈS
const { 
  setSelectedRestaurants, 
  setVisibleRestaurants,
  setPeriodMode, 
  setDateRange: setContextDateRange 
} = useAnalyticsContext();
```

**2. Modifier la fonction handleRestaurantClick (lignes 60-81)**

```typescript
const handleRestaurantClick = (restaurantId: string) => {
  // REMPLACER la sélection par ce seul restaurant (au lieu de toggle)
  setVisibleRestaurants([restaurantId]);
  setSelectedRestaurants([restaurantId]);
  setPeriodMode("range");
  setContextDateRange({ from: dateRange.start, to: dateRange.end });
  
  // Mettre à jour localStorage avec le BON restaurant
  const currentState = localStorage.getItem("analytics-context");
  const state = currentState ? JSON.parse(currentState) : {};
  const updatedState = {
    ...state,
    selectedRestaurants: [restaurantId],  // ← Le restaurant cliqué
    visibleRestaurants: [restaurantId],   // ← Le restaurant cliqué
    periodMode: "range",
    dateRange: {
      from: dateRange.start.toISOString(),
      to: dateRange.end.toISOString(),
    },
  };
  localStorage.setItem("analytics-context", JSON.stringify(updatedState));
  
  // Naviguer vers l'onglet Temps de préparation
  navigate("/analytics/operations?tab=prepTime");
};
```

## Résultat attendu

| Avant | Après |
|-------|-------|
| Clic sur Bonneuil → Affiche Athis-Mons | Clic sur Bonneuil → Affiche Bonneuil |
| Clic sur Antony → Affiche Athis-Mons | Clic sur Antony → Affiche Antony |
| Données incohérentes | Données du restaurant cliqué |

## Fichier modifié

| Fichier | Modification |
|---------|--------------|
| `src/components/compare/PrepTimeRankingBars.tsx` | Remplacer `toggleRestaurantSelection` par `setSelectedRestaurants` + `setVisibleRestaurants` avec le seul restaurant cliqué |

