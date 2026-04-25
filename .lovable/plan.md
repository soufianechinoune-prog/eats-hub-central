## Diagnostic

Sur le scatter "Visites vs Conversion" de la page Conversion, les bulles libellées **"Restaurant inconnu"** ne sont **pas** des Chicken Street oubliés. Ce sont en réalité les **44 restaurants de la marque TASTY CROUSTY**.

**Cause racine** (`src/pages/Analytics.tsx`, lignes 731–758)
La requête `allUberConversionData` appelle `fetchAllDailyConversion` **sans aucun filtre de marque ni de restaurant**, donc elle ramène les données de conversion de **toutes les marques** (Chicken Street + TASTY CROUSTY).

Ensuite, dans `AnalyticsCharts.tsx` (ligne 3334–3338), pour chaque `restaurant_id` trouvé dans ces données, on fait `restaurants.find(r => r.id === restaurantId)`. Or `restaurants` est la liste **scopée à la marque active** (Chicken Street). Tous les IDs Tasty Crousty ne sont donc pas trouvés et tombent sur le fallback `'Restaurant inconnu'`.

Vérification BDD sur les 90 derniers jours :
- Chicken Street : 92 restaurants avec données de conversion
- TASTY CROUSTY : 44 restaurants avec données de conversion
- Total = 136 ≈ 30 + 17 + 28 + 60 = 135 bulles affichées sur le scatter ✅

## Plan de correction

Filtrer la requête `allUberConversionData` (et la version Deliveroo équivalente) par les restaurants de la marque sélectionnée, exactement comme le reste de la page Analytics le fait déjà via `restaurantFilter`.

### Étape unique — Scoper les requêtes "all conversion" par marque

**Fichier** : `src/pages/Analytics.tsx`

1. Trouver les blocs `allUberConversionData` (≈ ligne 731) et `allDeliverooConversionData` s'il existe (≈ ligne 863 d'après le grep).
2. Passer `restaurantIds: restaurantFilter` à `fetchAllDailyConversion` (et seulement si `isRestaurantScopeReady` est vrai, pour éviter une fenêtre de race où on fetcherait avant que la liste de restaurants ne soit prête).
3. Ajouter `restaurantFilter` à la `queryKey` pour que la requête soit ré-exécutée quand l'utilisateur change de marque.
4. Ajouter `enabled: needsConversion && isRestaurantScopeReady && restaurantFilter && restaurantFilter.length > 0` pour respecter le pattern "analytics-ready guard" déjà utilisé partout ailleurs dans la page.

### Effet attendu

- Les 44 bulles "Restaurant inconnu" disparaissent du scatter Chicken Street.
- Les compteurs des quadrants (Stars / Opportunités / Niches / À surveiller) reflètent uniquement le périmètre Chicken Street.
- Idem pour le ranking par étape (composant `ConversionRankingByStage` qui consomme la même donnée).
- Aucun changement sur les autres marques : si l'utilisateur passe sur TASTY CROUSTY, il verra ses 44 restaurants correctement nommés.

### Hors périmètre

- Pas de changement de schéma BDD.
- Pas de modification du composant `ConversionScatterPlot` lui-même : la correction est en amont, dans la requête de données.
- Le fallback `'Restaurant inconnu'` reste en place comme garde-fou défensif au cas où un `restaurant_id` orphelin réapparaîtrait (ex: restaurant supprimé entre l'import et l'affichage).
