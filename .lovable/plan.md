
# Plan : Synchroniser la période lors du clic sur un restaurant

## Diagnostic

| Page | Filtre date | Mode date | Période |
|------|-------------|-----------|---------|
| Comparaison Notes | `review_date` | - | Mois précédent (1-31 janv) |
| Reviews | `order_date` OU `review_date` | `dateMode` (défaut: "order") | Lit le contexte Analytics |

L'écart de 3 avis (83 → 80) vient du fait que :
1. La page Comparaison filtre sur `review_date`
2. La page Reviews filtre sur `order_date` par défaut
3. Certains avis ont une `order_date` différente de leur `review_date`

## Solution

### Modification : `src/components/compare/RatingsFullRankingTable.tsx`

Lors du clic sur un restaurant, synchroniser le contexte Analytics avec la période de la page Comparaison :

```typescript
// Props à ajouter
interface RatingsFullRankingTableProps {
  data: RestaurantRating[];
  onExportPDF?: () => void;
  isExporting?: boolean;
  dateRange?: { start: Date; end: Date }; // ← NOUVEAU
}

// Dans handleRowClick, synchroniser la période
const handleRowClick = (restaurantId: string) => {
  setVisibleRestaurants([restaurantId]);
  setSelectedRestaurants([restaurantId]);
  
  // Synchroniser la période
  if (dateRange) {
    setContextDateRange({ from: dateRange.start, to: dateRange.end });
    setPeriodMode("range");
  }
  
  navigate("/analytics/reviews");
};
```

### Modification : `src/pages/RatingsComparison.tsx`

Passer le `dateRange` au composant :

```typescript
<RatingsFullRankingTable 
  data={rankingStats}
  onExportPDF={handleExportPDF}
  isExporting={isExporting}
  dateRange={dateRange}  // ← NOUVEAU
/>
```

## Résultat attendu

Quand l'utilisateur clique sur "Chicken Street - Douai" :
1. Le contexte est mis à jour avec la plage 1-31 janvier 2026
2. Le `periodMode` passe en "range"
3. La page Reviews affiche les avis pour la même période
4. Le nombre d'avis sera cohérent (83 avis avec filtre `review_date`)

## Note

L'écart restant possible (83 vs 80) viendrait du toggle "Par: Commande / Avis" sur la page Reviews. Si l'utilisateur veut voir exactement le même nombre, il devrait basculer sur "Avis" (qui filtre sur `review_date`).
