

# Ajouter les colonnes CA HT / TVA / CA TTC au tableau "Par Commande"

## Résumé

Remplacer la colonne unique "CA TTC" par 3 colonnes **CA HT | TVA | CA TTC** dans le tableau des commandes individuelles, et aligner le détail articles dessous.

## Modifications

### 1. `src/hooks/useFinancesDrilldown.ts`

- **Requête** (`fetchUberIndividualOrders`, ligne ~257) : ajouter `sales_excl_vat, vat_1_sales, vat_2_sales, vat_3_sales` au `select`
- **Interface** `OrderFinanceData` : ajouter `sales_excl_vat: number` et `vat_amount: number`
- **Processing** (`orderData` useMemo, ligne ~910) : calculer :
  - `sales_excl_vat = Math.abs(order.sales_excl_vat || 0)`
  - `vat_amount = Math.abs((order.vat_1_sales||0) + (order.vat_2_sales||0) + (order.vat_3_sales||0))`

### 2. `src/components/analytics/OrdersAnalysisSection.tsx`

- **Header** (ligne ~863-871) : remplacer la colonne "CA TTC" par 3 colonnes :
  - `CA HT` (triable sur `sales_excl_vat` — nouveau sort field à ajouter)
  - `TVA` (non triable, colonne info)
  - `CA TTC` (triable, existant)
- **Lignes commandes** (ligne ~987-989) : afficher 3 cellules au lieu d'une :
  - `formatCurrencyPrecise(order.sales_excl_vat)` 
  - `formatCurrencyPrecise(order.vat_amount)`
  - `formatCurrencyPrecise(order.sales_incl_vat)`
- **colSpan** (ligne 1019) : passer de 11 à 13 (2 colonnes ajoutées)

### 3. `src/components/analytics/OrderItemsDropdown.tsx`

- **Requête** : ajouter `sales_incl_vat, vat_1_sales, vat_2_sales, vat_3_sales` au select
- **Props** : ajouter `colSpan?: number` pour pouvoir s'adapter au tableau parent
- **Layout** : remplacer le layout libre par une `<table>` interne avec les colonnes alignées :

```text
| (chevron) | 2x Big Mac              |        | 8,50 € | 0,85 € | 9,35 € |    |    |    |    |    |    |    |
```

Chaque ligne article affichera :
- Première cellule (large) : `{qty}x {item_title}`
- HT : `sales_excl_vat` (fallback : `unit_price * quantity`)
- TVA : somme `vat_1 + vat_2 + vat_3`
- TTC : `sales_incl_vat` (fallback : HT + TVA)
- Les autres cellules restent vides pour s'aligner sur les colonnes parentes

### 4. Ajout du sort field `sales_excl_vat`

Dans `useFinancesDrilldown.ts`, ajouter `'sales_excl_vat'` au type `OrderSortField` et au `sortColumnMap`.

## Fichiers modifiés

- `src/hooks/useFinancesDrilldown.ts`
- `src/components/analytics/OrdersAnalysisSection.tsx`
- `src/components/analytics/OrderItemsDropdown.tsx`

## Résultat

Chaque commande affichera HT, TVA et TTC dans des colonnes dédiées. Le détail articles, une fois déplié, affichera les mêmes 3 montants alignés sous les bonnes colonnes — cohérence comptable complète.
