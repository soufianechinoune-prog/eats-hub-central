

## Synchronisation du filtre de période entre Vue d'ensemble et Comparaison Notes

### Probleme
Quand tu cliques sur "Note moyenne" depuis la Vue d'ensemble (filtrée sur Janvier 2026), la page "Comparaison Notes" s'ouvre avec le filtre "Semaine precedente" par defaut au lieu de conserver "Janvier 2026". C'est parce que la periode n'est pas transmise entre les deux pages.

### Solution
Appliquer le meme patron que les autres pages de comparaison (Downtime, Prep Time, etc.) : sauvegarder le contexte temporel dans le stockage local avant la navigation, et le relire a l'arrivee.

### Modifications techniques

**1. `src/pages/Overview.tsx`**
- Remplacer les 3 navigations directes vers `/compare/ratings` (Global, Uber, Deliveroo) par une fonction dediee `navigateToRatingsComparison`
- Cette fonction sauvegarde `periodMode`, `selectedYear`, `selectedMonth`, `customDateRange` et `isNetworkView` dans `localStorage` sous la cle `ratings-comparison-state` avant de naviguer

**2. `src/pages/RatingsComparison.tsx`**
- Ajouter la lecture du `localStorage` au demarrage (cle `ratings-comparison-state`), comme le fait deja `DowntimeComparison.tsx`
- Initialiser `periodMode`, `selectedYear`, `selectedMonth`, `customDateRange` et `isNetworkView` depuis l'etat sauvegarde
- Convertir `periodMode` de l'Overview vers le format attendu par RatingsComparison (ex: `"month"` -> `"custom_month"`)
- Ajouter la persistance de l'etat local a chaque changement de filtre pour que le bouton retour fonctionne aussi

