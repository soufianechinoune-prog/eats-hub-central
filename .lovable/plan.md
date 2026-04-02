

## Objectif
Résoudre les 2 problèmes restants : dédupliquer `customer_reviews` (4 appels → 1) et vérifier pourquoi `get_network_prep_time_summary` reste lent malgré les index existants.

## Diagnostic

### customer_reviews appelé 4 fois
Le problème : `useNetworkStats` et `useOverviewData` utilisent la même `queryKey` (`"overview-reviews"`) mais des `queryFn` différentes (paginated vs non-paginated, colonnes différentes). React Query ne peut pas dédupliquer quand les fonctions diffèrent.

**Solution** : Supprimer complètement la requête `customer_reviews` de `useNetworkStats` et passer les données reviews en prop depuis `Overview.tsx` (qui les a déjà via `useOverviewData`).

### get_network_prep_time_summary à 4s
L'index `idx_order_history_restaurant_date` sur `(restaurant_id, order_datetime)` existe déjà. La RPC a déjà un `statement_timeout` de 10s. Les 4s sont le temps réel de l'agrégation sur un gros volume — pas d'optimisation SQL supplémentaire évidente sans table pré-agrégée. Le timeout protège contre les cas extrêmes.

## Modifications (2 fichiers)

### 1. `src/hooks/useNetworkStats.ts`
- Ajouter `reviewsData` optionnel dans `UseNetworkStatsParams`
- Supprimer le `useQuery` pour `customer_reviews` (lignes 178-193)
- Supprimer `reviewsLoading` de `isLoading`
- Utiliser `reviewsData` passé en prop au lieu de données fetchées

### 2. `src/pages/Overview.tsx`
- Extraire `reviews.data` depuis `useOverviewData` (déjà disponible dans le retour)
- Passer `reviewsData` à `useNetworkStats`

### Vérification nécessaire
Il faut d'abord vérifier si `useOverviewData` expose les reviews dans son retour, ou s'il faut l'ajouter.

## Impact
- `customer_reviews` : 4 appels → 1 seul (via `useOverviewData`)
- `get_network_prep_time_summary` : déjà optimisé avec index + timeout 10s, pas de changement SQL

## Aucune migration SQL nécessaire

