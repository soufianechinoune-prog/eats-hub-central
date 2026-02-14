
# Ajouter le toggle Epingles/Reseau sur la section Uber One

## Objectif

Ajouter le composant `NetworkViewToggle` (identique a celui de la Vue d'ensemble) dans la section "Classement par restaurant" de l'analyse Uber One, pour permettre de basculer entre les restaurants epingles (14) et l'ensemble du reseau (92+).

## Modifications

### Fichier : `src/components/analytics/UberOneAnalysis.tsx`

1. **Importer** `NetworkViewToggle` depuis `@/components/compare/NetworkViewToggle`
2. **Ajouter un state** `isNetworkView` (default `false` = epingles)
3. **Ajouter une query** pour recuperer les restaurants epingles et tous les restaurants actifs (avec leurs counts) -- necessaire pour alimenter les badges du toggle
4. **Modifier la logique `restaurantIdsForQuery`** : quand `isNetworkView` est `true`, passer un tableau vide au hook (ce qui declenchera le fallback vers tous les restaurants actifs dans le hook) OU passer tous les IDs actifs
5. **Placer le toggle** dans le header de la carte "Classement par restaurant", a cote des boutons de tri existants

### Fichier : `src/hooks/useUberOneStats.ts`

6. **Modifier le fallback** : actuellement quand `restaurantIds` est vide, le hook utilise les restaurants epingles. On ajoutera un parametre optionnel `useAllActive` pour basculer vers tous les restaurants actifs au lieu des seuls epingles.

### Flux de donnees

```text
NetworkViewToggle (isNetworkView)
       |
       v
isNetworkView = false --> restaurantIds = selectedRestaurants OU pinned (14)
isNetworkView = true  --> restaurantIds = tous actifs (92+)
       |
       v
useUberOneStats({ restaurantIds, ... })
       |
       v
RPC get_uber_one_stats
       |
       v
Classement par restaurant (liste + sheet)
```

### Detail technique

- Le toggle sera place dans le `CardHeader` de "Classement par restaurant", entre le titre et les boutons de tri
- Deux queries supplementaires dans `UberOneAnalysis.tsx` pour obtenir les counts (pinned et actifs) pour les badges du toggle
- Le state `isNetworkView` remplacera la logique actuelle qui depend uniquement de `selectedRestaurants` du context global -- le toggle est local a cette section
