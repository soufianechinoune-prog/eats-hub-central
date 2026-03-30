

## Objectif
Remplacer les queries directes non filtrées sur `restaurants` par `useActiveRestaurants()` dans les pages concernées, pour garantir l'isolation multi-tenant.

## Fichiers à corriger

### 1. `src/pages/Disputes.tsx` (lignes 49-60)
- Supprimer le `useQuery(["restaurants"], ...)` qui charge tous les restaurants actifs sans filtre.
- Importer et utiliser `useActiveRestaurants()`.
- Mapper le résultat pour conserver la structure `{ id, name, city }`.

### 2. `src/pages/UberConnections.tsx` (lignes 53-62)
- Supprimer le `useQuery(["available-restaurants"], ...)`.
- Utiliser `useActiveRestaurants()` à la place.

### 3. `src/pages/UberNaming.tsx` (lignes 40-49)
- Supprimer le `useQuery(["available-restaurants-naming"], ...)`.
- Utiliser `useActiveRestaurants()` à la place.

### 4. `src/pages/RankingDetail.tsx` (lignes 96-106)
- Supprimer le `useQuery(["restaurants"], ...)` qui charge tous les restaurants sans filtre.
- Utiliser `useActiveRestaurants()` à la place.

### 5. `src/pages/OpeningHoursComparison.tsx` — PAS DE CHANGEMENT
- Déjà filtré via `activeRestaurantIds` qui proviennent de `useAnalyticsContext()` (scopé par marque).
- La query `.in("id", activeRestaurantIds)` est correcte.

### 6. `src/pages/RestaurantDetail.tsx` — PAS DE CHANGEMENT
- Charge un seul restaurant par son ID (paramètre URL).
- Les mutations (update/delete) opèrent sur cet ID unique.
- Pas de liste, pas de fuite inter-marque.

## Résultat attendu
- Disputes, UberConnections, UberNaming et RankingDetail ne montrent que les restaurants de la marque active.
- Aucune régression sur les pages déjà correctement scopées.

