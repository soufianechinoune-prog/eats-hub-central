
# Corriger l'affichage des données Uber One quand "Tous les restaurants" est sélectionné

## Problème identifié

Les données existent bien dans la base :
- ATHIS-MONS : 20 389 commandes (12 305 Uber One)
- BONNEUIL : 14 796 commandes (9 600 Uber One)
- JUVISY : 13 778 commandes (8 650 Uber One)
- ANTONY : 3 276 commandes (2 191 Uber One)

**Cause** : Quand "Tous les restaurants" est sélectionné, `selectedRestaurants = []` (tableau vide). Le hook `useUberOneStats` retourne immédiatement un tableau vide à la ligne 57.

## Solution

Modifier le hook `useUberOneStats` pour utiliser les restaurants "pinned" comme fallback quand aucun restaurant n'est explicitement sélectionné (même pattern que les autres hooks).

### Fichier à modifier : `src/hooks/useUberOneStats.ts`

**1. Ajouter une query pour récupérer les restaurants pinned**

```typescript
// Après la ligne 52
const { data: pinnedRestaurants } = useQuery({
  queryKey: ["pinned-restaurants-for-uber-one"],
  queryFn: async () => {
    const { data } = await supabase
      .from("restaurants")
      .select("id")
      .eq("is_active", true)
      .eq("is_pinned", true);
    return data?.map(r => r.id) || [];
  },
});
```

**2. Calculer les IDs effectifs à utiliser**

```typescript
// Avant la query principale
const effectiveRestaurantIds = useMemo(() => {
  if (restaurantIds.length > 0) return restaurantIds;
  return pinnedRestaurants || [];
}, [restaurantIds, pinnedRestaurants]);
```

**3. Modifier la query principale pour utiliser `effectiveRestaurantIds`**

```typescript
const { data: rawData, isLoading } = useQuery({
  queryKey: ["uber-one-stats", effectiveRestaurantIds, startDate.toISOString(), endDate.toISOString()],
  queryFn: async () => {
    if (effectiveRestaurantIds.length === 0) return [];
    
    // ... reste du code avec effectiveRestaurantIds au lieu de restaurantIds
  },
  enabled: effectiveRestaurantIds.length > 0,
});
```

---

## Fichier à modifier

| Fichier | Modification |
|---------|--------------|
| `src/hooks/useUberOneStats.ts` | Ajouter fallback vers restaurants pinned quand sélection vide |

---

## Résultat attendu

| Avant | Après |
|-------|-------|
| "Aucune donnée Uber One" | 52 239 commandes analysées |
| 0% Uber One | ~62% Uber One |
| Aucun graphique | Évolution mensuelle + Comparaison restaurants |
