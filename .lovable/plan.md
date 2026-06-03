# Switch Périmètre constant / élargi

Permettre à l'utilisateur de choisir, depuis le header de la page Overview, comment se calcule la comparaison VS N-1 :

- **Périmètre élargi (défaut, comportement actuel)** : on compare le total N (tous les restos sélectionnés) au total N-1 (mêmes IDs, même s'ils n'existaient pas encore).
- **Périmètre constant** : on ne garde, pour la comparaison, que les restaurants ouverts **à la fois** sur N et sur N-1. Les autres sont exclus du calcul de variation (mais restent visibles dans la liste, juste sans variation).

## Étapes

### 1. État global dans `AnalyticsContext`
- Ajouter `comparisonScope: "extended" | "constant"` + setter (défaut `"extended"`), persisté dans `localStorage` comme les autres prefs.

### 2. UI — switch dans le header Overview
- Petit toggle/segmented control à côté du sélecteur de période et du mode de comparaison (`yearOverYear` / `rollingPeriod`).
- Labels : « Périmètre élargi » / « Périmètre constant », avec tooltip explicatif (« Ne compare que les restos ouverts sur les 2 périodes »).
- Visible uniquement si `includeN1Comparison` est actif (comparaison affichée).

### 3. Logique dans `useNetworkStats`
Aujourd'hui (lignes 103-110, 132-135) :
- `restaurants` = `filterActiveRestaurants(raw, startDate, endDate)` → filtre uniquement sur la période N.
- N-1 = `setFullYear(-1)` sur les mêmes IDs, sans filtre d'activité.

Nouveau, quand `comparisonScope === "constant"` :
- Calculer `constantScopeIds` = restaurants actifs sur N **ET** sur N-1 (réutiliser `isActiveForPeriod` deux fois sur les `restaurantsRaw`).
- Pour le **total N-1** et le **total N utilisé dans la variation** (`prevTotalRevenue`, `prevTotalOrders`, `revenueVariation`), ne sommer que ces IDs.
- Au niveau ligne par restaurant : si un resto n'est pas dans `constantScopeIds`, mettre `revenueVariation = null` / `ordersVariation = null` (badge « N/A » dans le tableau).
- Le total N « brut » affiché reste inchangé (somme de tous les actifs N), seule la **variation** est recalculée à périmètre constant pour rester comparable.

Quand `comparisonScope === "extended"` : comportement actuel inchangé.

### 4. Indicateur visuel
- Afficher discrètement sous le bloc « VS N-1 » : « Comparaison à périmètre constant (X/Y restos) » quand le mode constant exclut au moins 1 resto, pour que l'utilisateur sache combien sont écartés.

## Hors scope
- Pas de changement sur les pages Finances, Analytics, Reviews — uniquement Overview / `useNetworkStats` pour cette v1. On pourra étendre ensuite si besoin.
- Pas de changement DB / RPC : tout reste côté client, on filtre juste les IDs passés/sommés.
