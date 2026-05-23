## Problème

Sur `/overview`, la sidebar canal n'affiche l'onglet **Uber Eats** qu'au bout de plusieurs secondes (cf. screenshot gauche → droite).

## Cause

Dans `src/pages/Overview.tsx` (lignes 517-528), la visibilité de l'onglet dépend de :

```ts
const hasUberData = useMemo(
  () => comparisonStats.some(r => r.platformBreakdown.uber.revenue > 0),
  [comparisonStats]
);
```

`comparisonStats` vient de `useNetworkStats(...)` — une grosse agrégation (revenus, rentabilité, notes, downtime, N-1…) qui prend plusieurs secondes sur 104 restaurants. Tant qu'elle n'a pas répondu, `comparisonStats = []` → `hasUberData = false` → l'onglet est masqué.

L'onglet Caisse, lui, est forcé à `true` donc apparaît immédiatement.

## Correctif (frontend uniquement, 1 fichier)

`src/pages/Overview.tsx` :

1. Récupérer `statsLoading` (déjà destructuré ligne 387).
2. Pendant le chargement → considérer Uber et Deliveroo comme disponibles par défaut (au lieu de masqués). Une fois `statsLoading=false`, on retombe sur la détection réelle pour cacher la plateforme si vraiment 0 €.

```ts
const hasUberData = useMemo(
  () => statsLoading ? true : comparisonStats.some(r => r.platformBreakdown.uber.revenue > 0),
  [comparisonStats, statsLoading]
);
const hasDeliverooData = useMemo(
  () => statsLoading ? true : comparisonStats.some(r => r.platformBreakdown.deliveroo.revenue > 0),
  [comparisonStats, statsLoading]
);
```

## Résultat

- L'onglet **Uber Eats** apparaît tout de suite (comme Caisse).
- Si après chargement le réseau n'a réellement aucun CA Uber/Deliveroo, l'onglet se masque comme avant.
- Aucun changement de logique métier ni de requête backend.

## Hors scope

L'optimisation de `useNetworkStats` elle-même (durée du chargement des cartes/tableau) n'est pas modifiée ici — uniquement la visibilité de l'onglet sidebar.
