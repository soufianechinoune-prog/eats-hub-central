## Problème

Sur le dashboard **Conversion**, quand l'utilisateur sélectionne 1 ou 2 ou 3 restaurants dans le filtre, le graphique **« Visites vs Conversion »** disparaît (il ne reste qu'1 ou 2 points, et le composant se masque sous le seuil de 2 points).

Comportement attendu : le graphique doit **rester affiché avec tous les restaurants de la marque**, et les restaurants sélectionnés doivent être **mis en surbrillance** (les autres atténués). Cela permet de voir le positionnement d'un restaurant par rapport au reste du réseau (ex : Chicken Street Athis-Mons par rapport aux 88 autres CS).

## Cause technique

Dans `src/pages/Analytics.tsx`, la requête `allUberConversionData` (qui alimente le scatter plot) est filtrée par `restaurantFilter`. Or `restaurantFilter` se réduit à la sélection courante quand l'utilisateur sélectionne des restaurants. Résultat : le scatter ne reçoit que les points sélectionnés au lieu de tous les restaurants de la marque.

Le composant `ConversionScatterPlot` accepte déjà une prop `highlightedRestaurants` — la logique de surbrillance existe, il manque juste les données complètes.

## Correction

**`src/pages/Analytics.tsx`** — la requête `allUberConversionData` doit toujours scoper sur **toute la marque active**, indépendamment de la sélection :

- Remplacer `restaurantIds: restaurantFilter` par `restaurantIds: chainRestaurantIds` (la liste complète des restaurants de la chaîne sélectionnée, déjà calculée ligne 260).
- Mettre à jour la `queryKey` (`chainRestaurantIds` au lieu de `restaurantFilter`) pour que le cache se rafraîchisse au changement de marque mais pas au changement de sélection.
- Ajuster la condition `enabled` pour utiliser `chainRestaurantIds.length > 0`.

La prop `selectedRestaurants` est déjà passée à `AnalyticsCharts` et transmise comme `highlightedRestaurants` au scatter — aucun changement nécessaire côté UI.

## Résultat attendu

- Sélection « Tous les restaurants » → comportement actuel inchangé (toute la marque affichée).
- Sélection de 1 à N restaurants → tous les points de la marque restent visibles ; ceux sélectionnés sont mis en surbrillance, les autres atténués.
- Les autres graphiques (funnel, KPI, courbes temporelles) continuent de respecter le filtre de sélection — seul le scatter « Visites vs Conversion » et son ranking associé changent de comportement.

## Note

Côté Deliveroo, je vérifierai en parallèle si une requête équivalente existe (`allDeliverooConversionData`). Si oui, j'appliquerai la même correction pour cohérence.