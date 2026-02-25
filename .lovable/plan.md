

# Alimenter la page "Revenus & Ventes" avec les données Deliveroo

## Diagnostic

La page "Revenus & Ventes" avec le filtre Deliveroo affiche 0 partout parce que les requetes cherchent dans les tables `daily_revenue` et `monthly_revenue` avec `platform = "deliveroo"`, mais ces tables ne sont jamais peuplees lors de l'import des releves Deliveroo. L'import ne remplit que la table `deliveroo_orders`.

La vue "Finances", elle, fonctionne deja car elle agregee directement depuis `deliveroo_orders` (lignes 330-467 de Analytics.tsx).

## Solution

Modifier la requete `deliverooRevenueData` dans `Analytics.tsx` (lignes 990-1032) pour agreger directement depuis `deliveroo_orders` au lieu de querier des tables vides. Meme approche pour `deliverooPrevRevenueData` (lignes 1089+).

### Fichier modifie : `src/pages/Analytics.tsx`

**A. Remplacer la query `deliverooRevenueData` (lignes 990-1032)**

Au lieu de querier `daily_revenue` / `monthly_revenue`, agreger depuis `deliveroo_orders` :

- Filtrer par `history_type IN ('Livraison', 'À emporter')` pour ne compter que les commandes reelles (coherent avec la logique finances existante)
- Grouper par jour (granularite daily) ou par mois (granularite monthly)
- Calculer `revenue_ttc` = somme des `order_amount`, `order_count` = nombre de lignes, `average_basket` = revenue / count
- Paginer avec des chunks de 1000 lignes (meme pattern que la query finances Deliveroo existante)

```typescript
// Pseudo-code de la nouvelle query
const allRows = await fetchAllDeliverooOrders(startDate, endDate, restaurantFilter);
const orderRows = allRows.filter(r => ORDER_TYPES.includes(r.history_type));

// Grouper par jour ou mois
const grouped = groupBy(orderRows, granularity === "daily" ? "day" : "month");
return Object.entries(grouped).map(([key, rows]) => ({
  date: key,
  revenue_ttc: sum(rows, r => Math.abs(r.order_amount)),
  order_count: rows.length,
  average_basket: revenue / count,
  month: ...,
  year: ...,
}));
```

**B. Remplacer la query `deliverooPrevRevenueData` (lignes 1089-1130)**

Meme logique mais pour l'annee N-1 (dates decalees d'un an).

**C. Factoriser la fonction de fetch paginee**

Extraire une fonction `fetchAllDeliverooOrders(start, end, restaurantFilter)` reutilisable, car le meme pattern de pagination existe deja dans la query finances Deliveroo (lignes 354-382). Les deux queries pourront partager cette fonction.

### Resultat

- Les graphiques CA, Commandes, Panier Moyen et la vue Tableau afficheront les donnees Deliveroo correctement
- La comparaison N-1 fonctionnera aussi
- La vue "Global" combinera Uber + Deliveroo comme prevu (lignes 1196-1198)
- Aucune modification de base de donnees necessaire

### Fichiers modifies
- `src/pages/Analytics.tsx` (~50 lignes modifiees)

