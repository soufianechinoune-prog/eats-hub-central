## Objectif

Sur le graphique "Évolution du Chiffre d'Affaires" (`/analytics/revenue`), retirer le toggle de type de graphique (barres / courbe) et forcer l'affichage en courbe uniquement.

## Changements

**Fichier:** `src/components/analytics/AnalyticsCharts.tsx` (lignes ~2183-2210)

1. Supprimer le bloc `{revenueViewMode === 'chart' && (<div>...barres/courbe...</div>)}` qui contient les deux boutons `BarChart3` et `TrendingUp`.
2. Forcer `revenueChartType` à `'line'` (soit en supprimant l'état, soit en initialisant à `'line'` sans setter exposé).
3. Garder le rendu de la courbe inchangé.

Aucun changement de logique métier ni de données — uniquement UI.
