

# Amelioration de la page Conversion

## Problemes identifies

1. **Pas de granularite hebdomadaire** : en vue annee, le graphique agrege par mois uniquement. Le code `aggregatedConversionData` dans `AnalyticsCharts.tsx` supporte deja la granularite weekly (lignes 1220-1274), mais le hook `useDataGranularity` ne retourne "weekly" que pour des periodes de 31-93 jours. En vue annuelle (~365 jours), il retourne "monthly". Il faut permettre a l'utilisateur de choisir manuellement la granularite.

2. **Scatter plot "Visites vs Conversion" illisible** : avec ~100 restaurants, les bulles se superposent et il est difficile de distinguer les restaurants. Le graphique fait 300px de haut sans zoom ni filtre.

## Plan de correction

### 1. Selecteur de granularite pour la conversion

**Fichier : `src/components/analytics/AnalyticsCharts.tsx`**

- Ajouter un toggle "Mois / Semaine" dans le header de la section Conversion (a cote du bouton Telecharger), visible uniquement en vue annuelle ou sur des periodes > 1 mois.
- Ce toggle override la granularite automatique du hook `useDataGranularity` pour la section conversion uniquement.
- Quand "Semaine" est selectionne, forcer `granularity = "weekly"` dans le calcul de `aggregatedConversionData` (le code weekly existe deja, il suffit de l'activer).

**Fichier : `src/pages/Analytics.tsx`**

- Passer la granularite selectionnee par l'utilisateur (ou l'auto) au composant `AnalyticsCharts`.
- S'assurer que les donnees brutes quotidiennes sont bien fetchees (et non pre-agregees par mois) quand le mode semaine est actif. Actuellement, en vue annee, `aggregateDailyConversionByMonth` est appelee avant de passer les donnees — il faudra retourner les daily rows brutes pour que le composant puisse faire l'agregation weekly lui-meme.

### 2. Amelioration du scatter plot "Visites vs Conversion"

**Fichier : `src/components/analytics/ConversionScatterPlot.tsx`**

- Augmenter la hauteur du graphique de 300px a 400px pour plus d'espace.
- Ajouter un mode **tableau interactif** en alternative au scatter : un toggle "Graphique / Tableau" en haut a droite.
  - Le tableau afficherait : Rang, Restaurant, Visites, Commandes, Taux conversion, Quadrant (badge couleur).
  - Triable par colonne.
- Reduire la taille des bulles pour moins de chevauchement (`range={[60, 400]}` au lieu de `[100, 800]`).
- Ajouter les noms des restaurants selectionnes directement sur le graphique (labels sur les points highlighted).
- Ajouter un filtre par quadrant : pouvoir cliquer sur la legende (Stars, Opportunites, Niches, A surveiller) pour ne voir que les restaurants de ce quadrant.

### 3. Tronquer les graphiques a la derniere date importee

Meme correctif que pour les onglets Operations : le graphique "Taux de Conversion Global" et le funnel chart affichent des mois vides jusqu'a decembre. Il faut les couper a la derniere date disponible dans `aggregatedConversionData`.

## Details techniques

- La donnee `daily_conversion` est bien quotidienne (1 row/jour/restaurant) — pas de limite structurelle pour l'agregation hebdomadaire.
- Le code weekly dans `aggregatedConversionData` (lignes 1220-1274) est deja fonctionnel, il est juste jamais active en vue annee car `granularity` vaut "monthly".
- ~8000 rows pour 3 mois x 100 restaurants — performant sans RPC supplementaire.

