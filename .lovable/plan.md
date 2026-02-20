

## Tri interactif dans la vue "Mois"

### Probleme

Dans la vue "Mois" du Comparatif de Rentabilite, les colonnes sont cliquables (tri) mais les restaurants a l'interieur de chaque mois sont toujours tries par rentabilite decroissante. Le tri selectionne par l'utilisateur (CA, Commission, Promos, etc.) n'est pas applique aux lignes restaurant dans les accordeons mensuels.

### Solution

Appliquer la logique de tri (`sortColumn` / `sortDirection`) aux `restaurantData` de chaque mois, au lieu du tri fixe `.sort((a, b) => b.profitability - a.profitability)`.

### Details techniques

**Fichier : `src/components/analytics/ProfitabilityComparisonTable.tsx`**

**Ligne 545** - Remplacer le tri fixe des `restaurantData` par un tri dynamique base sur `sortColumn` et `sortDirection` :

```typescript
// Avant (ligne 545)
.sort((a, b) => b.profitability - a.profitability);

// Apres
.sort((a, b) => {
  let comparison = 0;
  switch (sortColumn) {
    case 'sales':
      comparison = a.sales - b.sales;
      break;
    case 'profitability':
      comparison = a.profitability - b.profitability;
      break;
    case 'commission':
      comparison = a.uberFeeRate - b.uberFeeRate;
      break;
    case 'promo':
      comparison = a.promoRate - b.promoRate;
      break;
    case 'refund':
      comparison = a.refundRate - b.refundRate;
      break;
    case 'payout':
      comparison = a.totalPayout - b.totalPayout;
      break;
    default:
      comparison = a.profitability - b.profitability;
  }
  return sortDirection === 'asc' ? comparison : -comparison;
});
```

Il faut egalement ajouter `sortColumn` et `sortDirection` aux dependances du `useMemo` de `monthGroups` (ligne ~575) pour que le tri se recalcule quand l'utilisateur clique sur un en-tete de colonne.

