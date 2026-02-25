

# Barre animée de répartition CA Uber / Deliveroo

## Concept

Ajouter un composant visuel au-dessus du tableau "Comparatif des restaurants" montrant la répartition du chiffre d'affaires entre Uber Eats et Deliveroo sur l'ensemble du réseau. Une barre horizontale animée avec les deux segments colorés (vert Uber, cyan Deliveroo) qui se "remplissent" au chargement avec une animation fluide.

## Design visuel

```text
┌─────────────────────────────────────────────────────────────┐
│  Répartition du CA réseau                                   │
│                                                             │
│  ██████████████████████████████░░░░░░░░░░░░░░  total: XX €  │
│  ◄──── Uber Eats 65.1% ─────►◄─ Deliveroo 34.9% ─►        │
│                                                             │
│  [🟢 Uber Eats]  80 485 €    [🔵 Deliveroo]  24 408 €      │
└─────────────────────────────────────────────────────────────┘
```

- Barre horizontale avec coins arrondis
- Segment gauche vert (Uber Eats) et segment droit cyan (Deliveroo)
- Animation d'entrée : la barre se remplit de 0% à sa valeur réelle (via CSS transition ou framer-motion)
- Les montants affichés avec le hook `useAnimatedCounter` pour un compteur animé
- Pourcentages affichés dans chaque segment si suffisamment large
- Légende en dessous avec badges plateforme + montants

## Données

Les données sont déjà disponibles : on agrège `stats[].platformBreakdown.uber.revenue` et `stats[].platformBreakdown.deliveroo.revenue` depuis le tableau `stats` retourné par `useNetworkStats`. Aucune requête supplémentaire nécessaire.

## Modifications

### 1. Nouveau composant `src/components/overview/PlatformRevenueSplit.tsx`

- Props : `stats: RestaurantNetworkStats[]`, `isLoading: boolean`
- Calcul : somme des `platformBreakdown.uber.revenue` et `platformBreakdown.deliveroo.revenue` sur tout le réseau
- Barre horizontale animée avec `framer-motion` (motion.div avec animate width de 0 à X%)
- Compteur animé pour les montants via `useAnimatedCounter`
- Skeleton pendant le chargement
- Style : Card avec la même charte graphique que le reste (border-border/50, backdrop-blur)

### 2. `src/pages/Overview.tsx` (~ligne 621)

- Importer et placer `PlatformRevenueSplit` juste avant le `RestaurantComparisonTable`
- Passer `stats={comparisonStats}` et `isLoading={statsLoading}`

### Fichiers
- **Créer** : `src/components/overview/PlatformRevenueSplit.tsx`
- **Modifier** : `src/pages/Overview.tsx` (2 lignes : import + placement)

