
# Ajouter le toggle Epingles/Reseau au niveau global de la page Analytics

## Objectif

Deplacer le `NetworkViewToggle` du niveau local (section Uber One uniquement) vers le niveau global de la page Analytics, dans le bandeau de filtres partage (`AnalyticsHeader`). Ce toggle influencera **tous les onglets** : Disponibilite, Temps de preparation, Temps d'attente, Temps total, Erreurs, et Uber One.

## Architecture

Le toggle sera gere via le `AnalyticsContext` pour que son etat soit accessible partout sans prop drilling.

```text
AnalyticsContext (isNetworkView state)
       |
       v
AnalyticsHeader (affiche le NetworkViewToggle)
       |
       v
OperationsAnalytics --> restaurantIdsFilter reagit a isNetworkView
       |
       +-- Disponibilite (utilise le filtre)
       +-- Temps de prep (utilise le filtre)
       +-- Temps d'attente (utilise le filtre)
       +-- Temps total (utilise le filtre)
       +-- Erreurs (utilise le filtre)
       +-- Uber One (utilise le filtre, supprime son toggle local)
```

## Fichiers modifies

### 1. `src/contexts/AnalyticsContext.tsx`
- Ajouter `isNetworkView: boolean` et `setIsNetworkView` au contexte
- Default `false` (epingles)
- Persister dans localStorage avec le reste de l'etat

### 2. `src/components/analytics/AnalyticsHeader.tsx`
- Importer `NetworkViewToggle`
- Ajouter une query pour compter les restaurants epingles et actifs (pour les badges)
- Placer le toggle dans le bandeau de filtres, entre le selecteur de restaurant et les boutons de plateforme (ou a droite du selecteur de periode)

### 3. `src/components/analytics/OperationsAnalytics.tsx`
- Lire `isNetworkView` depuis le contexte
- Modifier `restaurantIdsFilter` (ligne 116) : quand `isNetworkView` est `true` et qu'aucun restaurant n'est selectionne manuellement, passer `null` (= tous les actifs) au lieu du filtre vide actuel

### 4. `src/components/analytics/UberOneAnalysis.tsx`
- Supprimer le `NetworkViewToggle` local et son state `isNetworkView` local
- Lire `isNetworkView` depuis le contexte a la place
- Supprimer les queries locales de comptage pinned/network (desormais dans le Header)

### 5. `src/pages/Analytics.tsx`
- Adapter `restaurantFilter` (ligne 257) pour reagir au `isNetworkView` du contexte
- Quand `isNetworkView` est `true` et aucun restaurant selectionne, passer `undefined` pour inclure tous les restaurants

## Comportement attendu

| Situation | isNetworkView OFF | isNetworkView ON |
|---|---|---|
| Aucun restaurant selectionne | Donnees des epingles (14) | Donnees de tout le reseau (92+) |
| Restaurants selectionnes manuellement | Donnees des selectionnes | Donnees des selectionnes (le toggle est visible mais la selection manuelle prime) |

## Placement visuel du toggle

Le toggle sera place dans le bandeau sticky `AnalyticsHeader`, sur la meme ligne que les filtres, a droite du selecteur de periode. Il affichera les badges avec le nombre d'epingles et le nombre total de restaurants actifs.
