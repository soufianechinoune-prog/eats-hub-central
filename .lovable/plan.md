

# Unifier le calcul du temps de préparation

## Problème identifié

Les deux pages (Vue d'ensemble et Comparaison Prep Time) affichent des valeurs différentes car :

| Page | Période | Filtre SQL |
|------|---------|------------|
| Vue d'ensemble | 30 derniers jours glissants | Pas de filtre `IS NOT NULL` dans la requête |
| Comparaison | Mois précédent complet | Filtre `.not("initial_prep_time_minutes", "is", null)` |

**Valeur réelle en base** (22 déc 2025 - 22 jan 2026) : **6m 53s** (6.88 min sur 3127 commandes)

## Solution : Unifier le filtre SQL

Ajouter le filtre `.not("initial_prep_time_minutes", "is", null)` directement dans les requêtes SQL plutôt que de filtrer en JavaScript après coup. Cela garantit :
- Moins de données transférées
- Calcul identique partout
- Cohérence avec PrepTimeComparison.tsx

## Fichiers à modifier

### 1. `src/pages/Overview.tsx`

**Ligne ~315** - Ajouter le filtre `NOT NULL` dans la boucle de pagination :

```typescript
// Dans la boucle while (historyHasMore)
const { data: historyPageData, error: historyError } = await supabase
  .from("order_history")
  .select("restaurant_id, initial_prep_time_minutes, avoidable_wait_time_minutes, order_datetime, platform")
  .gte("order_datetime", startDate.toISOString())
  .lte("order_datetime", endDate.toISOString())
  .in("restaurant_id", restaurantIds)
  .not("initial_prep_time_minutes", "is", null)  // ← AJOUTER
  .order("order_datetime", { ascending: true })
  .order("restaurant_id", { ascending: true })
  .range(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE - 1);
```

### 2. `src/hooks/useNetworkStats.ts`

**Ligne ~198** - Même correction dans le hook centralisé :

```typescript
// Dans la boucle while (hasMore)
const { data: pageData, error } = await supabase
  .from("order_history")
  .select("restaurant_id, initial_prep_time_minutes")
  .gte("order_datetime", startDate.toISOString())
  .lte("order_datetime", endDate.toISOString())
  .in("restaurant_id", restaurantIds)
  .not("initial_prep_time_minutes", "is", null)  // ← AJOUTER
  .order("order_datetime", { ascending: true })
  .order("restaurant_id", { ascending: true })
  .range(page * pageSize, (page + 1) * pageSize - 1);
```

## Note importante

Les valeurs peuvent encore différer légèrement entre Overview et Comparaison si les **périodes sélectionnées** sont différentes :
- Overview "30 derniers jours" ≠ Comparaison "Mois précédent"

C'est normal et attendu. L'important est que pour une **même période**, les valeurs soient identiques.

## Résultat attendu

| Avant | Après |
|-------|-------|
| Calculs différents selon la page | Calcul unifié via même filtre SQL |
| Filtre JS post-requête (moins fiable) | Filtre SQL direct (plus efficace) |

