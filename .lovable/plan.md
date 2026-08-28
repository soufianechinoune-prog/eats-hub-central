# Sélecteur de période — page Rentabilité Livraison

## Problème

La page `/chataigne/rentabilite` utilise un sélecteur de période **maison** (bouton outline gris + calendrier 2 mois dans la carte Filtres), différent de toutes les autres pages analytics. Il est mal positionné (dans la carte de filtres, aligné à gauche), sans onglets Rapide / Mois / Année / Période perso., et sa période n'est pas synchronisée avec le reste de l'app.

Cause : la page appelle `AnalyticsHeader` avec `hidePeriodSelector` et gère sa propre plage dans un state local (`range`, `periodOpen`).

## Ce qu'on fait

Aligner la page sur le standard des autres pages (Chataigne, Ventes sur place) :

1. Utiliser `<AnalyticsHeader />` sans `hidePeriodSelector` → le sélecteur vert « Semaine précédente / Mois / Année / Période perso. » revient en haut à droite, exactement comme ailleurs, et la période reste synchronisée globalement entre les pages.
2. Supprimer le popover calendrier local et son state (`range`, `periodOpen`, `periodLabel`, imports `Calendar`/`CalendarIcon` devenus inutiles).
3. Calculer `start` / `end` via le hook existant `useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange })` alimenté par `useAnalyticsContext()` — même pattern que `Chataigne.tsx`.
4. La carte Filtres ne garde que le filtre **Versions** + le badge « X restaurants affichés ».
5. L'export Excel continue d'afficher la période dans l'onglet « Hypothèses » (valeurs issues du nouveau `start`/`end`).

## Détails techniques

- Fichier touché : `src/pages/DeliveryProfitability.tsx` uniquement. Aucun changement SQL, aucun changement de calcul (markup, BOGO, coût livreur, gain net inchangés).
- La `queryKey` `["delivery-pnl", start, end, restaurantFilter]` reste valable ; seules les sources de `start`/`end` changent.
- Effet de bord assumé : la période par défaut ne sera plus « 1er juin → aujourd'hui » mais la période globale mémorisée dans le contexte analytics (comme sur les autres pages).
