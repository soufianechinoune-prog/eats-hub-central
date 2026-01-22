

# Corriger la navigation depuis "Comparaison Temps d'inactivité"

## Problèmes identifiés

### 1. Mauvais restaurant affiché
- **Symptôme** : Clic sur Bonneuil ou Juvisy → Analytics affiche toujours Athis-Mons
- **Cause** : `toggleRestaurantSelection(restaurantId)` ajoute le restaurant à la sélection existante au lieu de la remplacer

### 2. Mauvaise période
- **Symptôme** : La page Analytics affiche "Janvier 2026" au lieu de "Semaine précédente (12-18 janv)"
- **Cause** : Le code force `setPeriodMode("month")` et `setSelectedMonth(new Date().getMonth() + 1)`

### 3. Données incohérentes
- **Symptôme** : Athis-Mons = 100% sur Comparaison vs 98.6% sur Analytics
- **Cause** : Conséquence du problème 2 - les données du mois entier sont différentes de celles de la semaine

## Solution

### Fichier à modifier : `src/components/compare/DowntimeRankingBars.tsx`

**1. Mettre à jour les imports du contexte (ligne 53)**

```typescript
// AVANT
const { toggleRestaurantSelection, setSelectedMonth, setSelectedYear, setPeriodMode } = useAnalyticsContext();

// APRÈS  
const { 
  setSelectedRestaurants, 
  setVisibleRestaurants,
  setPeriodMode, 
  setDateRange: setContextDateRange 
} = useAnalyticsContext();
```

**2. Ajouter le dateRange en prop du composant**

Le composant doit recevoir la période sélectionnée depuis la page parent.

```typescript
// Props
interface DowntimeRankingBarsProps {
  stats: RestaurantStat[];
  dateRange: { start: Date; end: Date };  // Ajouter cette prop
}

export const DowntimeRankingBars = ({ stats, dateRange }: DowntimeRankingBarsProps) => {
```

**3. Réécrire la fonction handleRestaurantClick (lignes 56-65)**

```typescript
const handleRestaurantClick = (restaurantId: string) => {
  // REMPLACER la sélection par ce seul restaurant
  setVisibleRestaurants([restaurantId]);
  setSelectedRestaurants([restaurantId]);
  
  // Utiliser la période de la page Comparaison (range)
  setPeriodMode("range");
  setContextDateRange({ from: dateRange.start, to: dateRange.end });
  
  // Mettre à jour localStorage pour persister le contexte
  const currentState = localStorage.getItem("analytics-context");
  const state = currentState ? JSON.parse(currentState) : {};
  const updatedState = {
    ...state,
    selectedRestaurants: [restaurantId],
    visibleRestaurants: [restaurantId],
    periodMode: "range",
    dateRange: {
      from: dateRange.start.toISOString(),
      to: dateRange.end.toISOString(),
    },
  };
  localStorage.setItem("analytics-context", JSON.stringify(updatedState));
  
  // Naviguer vers l'onglet Disponibilité
  navigate("/analytics/operations?tab=availability");
};
```

### Fichier à modifier : `src/pages/DowntimeComparison.tsx` (ligne 203)

Passer la prop `dateRange` au composant :

```typescript
// AVANT
<DowntimeRankingBars stats={restaurantStats} />

// APRÈS
<DowntimeRankingBars stats={restaurantStats} dateRange={dateRange} />
```

## Résultat attendu

| Avant | Après |
|-------|-------|
| Clic Bonneuil → Athis-Mons | Clic Bonneuil → Bonneuil |
| Clic Juvisy → Athis-Mons | Clic Juvisy → Juvisy |
| Période: Janvier 2026 | Période: 12-18 janv. 2026 |
| Taux: 98.6% (mois entier) | Taux: 100% (semaine sélectionnée) |

## Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/components/compare/DowntimeRankingBars.tsx` | Remplacer toggle par set, passer dateRange, corriger navigation |
| `src/pages/DowntimeComparison.tsx` | Passer dateRange comme prop |

