

# Charger toutes les commandes d'un coup

## Analyse

Tu as actuellement ~2783 commandes sur la période. Le système charge 50 à la fois avec un scroll infini. Charger tout d'un coup est faisable mais il y a des compromis à connaître.

## Impact performance

- **2 000-3 000 commandes** : requête ~1-2 secondes, rendu DOM acceptable
- **10 000+ commandes** : le navigateur pourrait ramer avec autant de lignes DOM
- **Recommandation** : charger toutes les données en mémoire mais garder une virtualisation du rendu (afficher toutes les lignes sans pagination, mais le navigateur ne rend que celles visibles). Alternativement, pour ~3K lignes, un rendu brut reste fluide.

## Approche retenue : tout charger, supprimer le scroll infini

Pour ~3K commandes c'est parfaitement gérable. On supprime la pagination côté serveur et on charge tout.

### 1. `src/hooks/useFinancesDrilldown.ts`

- `fetchUberIndividualOrders` : remplacer `.range(0, limit - 1)` par une boucle `while` avec `PAGE_SIZE = 1000` (comme les autres fonctions du hook) pour récupérer toutes les commandes
- Supprimer le paramètre `limit` de cette fonction
- Supprimer `orderLimit` des paramètres du hook
- Le `count` query reste pour afficher le total mais `hasMore` sera toujours `false`
- Même traitement pour `fetchDeliverooIndividualOrders`

### 2. `src/components/analytics/OrdersAnalysisSection.tsx`

- Supprimer `orderLimit`, `setOrderLimit`, `ORDER_PAGE_SIZE`
- Supprimer le `IntersectionObserver` et `loadMoreRef`
- Supprimer le loader de scroll infini en bas du tableau
- Le compteur affichera simplement "2783 commandes" au lieu de "100 / 2783"
- Les resets `setOrderLimit(ORDER_PAGE_SIZE)` dans les handlers de filtre/tri deviennent inutiles — les supprimer

### 3. Performance

- Un spinner s'affichera pendant le chargement initial (~1-2s)
- Le tri et filtrage client seront instantanés car toute la data est en mémoire
- Pour les items (détail déplié), le chargement reste à la demande (au clic sur le chevron)

## Résultat

- Toutes les commandes visibles immédiatement après chargement
- Plus de "charger plus" / scroll infini
- Tri et filtres instantanés
- Les stats KPI (Livraison/Emporté) restent calculées côté serveur via la query dédiée

