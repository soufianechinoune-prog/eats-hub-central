

# Suppression des graphiques "Top 10 Restaurants" et "Répartition mensuelle"

## Objectif
Supprimer les deux graphiques suivants de la page Analytics (onglet Revenus & Ventes) :
1. **"Top 10 Restaurants par CA"** - Graphique horizontal à barres
2. **"Répartition mensuelle par Restaurant"** - Graphique groupé par mois

## Modification à effectuer

| Fichier | Action |
|---------|--------|
| `src/components/analytics/AnalyticsCharts.tsx` | Supprimer les lignes 3025-3129 (les deux blocs Card) |

## Détails techniques

Les deux graphiques sont des `<Card>` conditionnels affichés quand :
- `showRevenue` est vrai (onglet Revenus actif)
- `isMultiRestaurant` est vrai (plusieurs restaurants sélectionnés)

Le code à supprimer :
- Lignes 3025-3084 : "Top 10 Restaurants par CA"
- Lignes 3086-3129 : "Répartition mensuelle par Restaurant"

Le graphique suivant ("Conversion Funnel Chart" à partir de la ligne 3131) reste intact.

## Impact

- Aucun effet sur les autres fonctionnalités
- Les données `topRestaurantsData` et `revenueByRestaurantData` peuvent potentiellement être nettoyées si elles ne sont plus utilisées ailleurs (optimisation optionnelle)

