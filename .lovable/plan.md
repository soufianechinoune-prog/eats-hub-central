

# Plan : Corriger l'incohérence des comptages d'avis

## Problème identifié

Les totaux d'avis diffèrent entre les pages à cause de l'utilisation de `toISOString()` qui convertit les dates en UTC. Cette conversion dépend du timezone du navigateur :

| Utilisateur | Timezone | Avis captés en janvier |
|-------------|----------|------------------------|
| France | UTC+1 | 9410 |
| Californie | UTC-8 | 9023 |

L'écart de ~400 avis au niveau réseau (et ~11 pour Montigny) vient de cette différence.

## Solution

Remplacer les filtres basés sur `toISOString()` par des filtres en **format date locale** (`YYYY-MM-DD`), cohérents avec la logique utilisée dans `useReviews.ts`.

### Fichier : `src/pages/RatingsComparison.tsx`

**Avant (lignes 100-101) :**
```typescript
.gte("review_date", dateRange.start.toISOString())
.lte("review_date", dateRange.end.toISOString())
```

**Après :**
```typescript
// Nouvelle fonction utilitaire (à ajouter en haut du fichier)
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Puis dans la requête
.gte("review_date", formatDateLocal(dateRange.start))
.lte("review_date", formatDateLocal(dateRange.end))
```

### Alternative : utiliser le hook centralisé

Puisque `useReviews.ts` gère déjà correctement les dates, on pourrait réutiliser cette logique :

1. Importer et utiliser `useCustomerReviews` depuis `src/hooks/useReviews.ts`
2. Passer les `restaurantIds` des restaurants actifs
3. Le hook gère déjà la pagination et le format de date correct

## Résultat attendu

| Page | Nombre d'avis Montigny | Nombre d'avis réseau |
|------|------------------------|----------------------|
| Comparaison Notes | 742 | 9410 |
| Avis (mode "Avis") | 742 | 9410 |

Les deux pages afficheront le même nombre, indépendamment du timezone du navigateur.

## Fichiers à modifier

| Fichier | Changement |
|---------|------------|
| `src/pages/RatingsComparison.tsx` | Remplacer `toISOString()` par format `YYYY-MM-DD` |

## Tests de validation

1. Vérifier que le total réseau passe de ~9023 à 9410
2. Vérifier que Montigny affiche 742 avis
3. Cliquer sur Montigny → la page Avis doit aussi montrer 742

