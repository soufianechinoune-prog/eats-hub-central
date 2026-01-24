
# Ajouter des filtres sur la page "Analyse des Horaires"

## Problème identifié

La page `/compare/opening-hours` :
1. Récupère automatiquement tous les restaurants épinglés sans possibilité de filtrer
2. La section "Top Produits par Créneau" ne montre pas quels restaurants sont analysés
3. Pas de cohérence avec les autres pages Analytics qui utilisent `AnalyticsHeader`

## Solution proposée

Intégrer le contexte global `AnalyticsContext` et utiliser le composant `AnalyticsHeader` existant pour avoir les mêmes filtres que sur `/analytics/revenue`.

### Changements à effectuer

**Fichier : `src/pages/OpeningHoursComparison.tsx`**

1. **Importer et utiliser `AnalyticsContext`** :
   - Remplacer la récupération automatique des restaurants épinglés par le contexte global
   - Utiliser `selectedRestaurants`, `visibleRestaurants`, `selectedPlatform`, `periodMode`, `dateRange`, etc.

2. **Ajouter le composant `AnalyticsHeader`** :
   - Placer le header sticky avec le sélecteur de restaurants, plateforme et période
   - Supprimer le bouton "Retour" et le `OverviewPeriodSelector` actuels

3. **Adapter les requêtes de données** :
   - Utiliser `visibleRestaurants` du contexte au lieu de `pinnedRestaurants`
   - Synchroniser les dates avec le contexte (`dateRange`, `periodMode`)

4. **Afficher les restaurants sélectionnés** :
   - Dans la section "Top Produits par Créneau", ajouter un sous-titre indiquant quels restaurants sont analysés

### Avant / Après

| Élément | Avant | Après |
|---------|-------|-------|
| Sélection restaurants | Auto (épinglés uniquement) | Multi-select comme Analytics |
| Filtre plateforme | Absent | Uber Eats / Deliveroo / Global |
| Filtre période | `OverviewPeriodSelector` basique | Même que Analytics (Quick, Mois, Année, Perso) |
| Indication restaurants | Absent | Badge ou texte sous le titre de chaque section |

---

## Section technique

### Structure du code modifié

```typescript
// Imports à ajouter
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";

// Dans le composant
const {
  visibleRestaurants,
  selectedPlatform,
  periodMode,
  selectedYear,
  selectedMonth,
  dateRange,
} = useAnalyticsContext();

// Remplacer la query pinnedRestaurants par les visibleRestaurants
const restaurantIds = visibleRestaurants;

// Calcul des dates basé sur le contexte (même logique que AnalyticsCharts)
const { startDate, endDate } = useMemo(() => {
  // Logique selon periodMode...
}, [periodMode, selectedYear, selectedMonth, dateRange]);
```

### Indication des restaurants dans les sections

```tsx
// Dans ProductsByTimeSlotAnalysis, ajouter un prop pour afficher les noms
<CardTitle className="text-lg flex items-center gap-2">
  <Package className="h-5 w-5 text-primary" />
  Top Produits par Créneau Horaire
  <Badge variant="secondary" className="ml-2 text-xs">
    {totalOrders.toLocaleString()} commandes analysées
  </Badge>
</CardTitle>
{/* Nouveau: indication des restaurants */}
{restaurantNames.length > 0 && (
  <p className="text-sm text-muted-foreground mt-1">
    Données : {restaurantNames.join(", ")}
  </p>
)}
```

### Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/pages/OpeningHoursComparison.tsx` | Intégrer `AnalyticsContext` + `AnalyticsHeader`, remplacer la logique de filtres |
| `src/components/compare/ProductsByTimeSlotAnalysis.tsx` | Ajouter un prop `restaurantNames` pour afficher les restaurants analysés |
| `src/components/compare/HourlyOpportunitiesAnalysis.tsx` | Idem - afficher les restaurants concernés |
