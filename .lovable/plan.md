

# Ajouter "Temps Prépa+Livraison" dans les vignettes et le tableau comparatif

## Contexte

Actuellement, les vignettes KPI en haut de la page Overview et le tableau comparatif des restaurants affichent uniquement le "Temps de préparation" (`initial_prep_time_minutes`). Vous souhaitez ajouter/remplacer par le "Temps Prépa+Livraison" (`total_prep_delivery_time_minutes`) qui mesure le temps total de la commande à la livraison.

## Solution proposée

### 1. Modifier le hook `useNetworkStats` pour récupérer le temps total

**Fichier** : `src/hooks/useNetworkStats.ts`

**Changements** :
- Ajouter une nouvelle requête pour récupérer `total_prep_delivery_time_minutes` de `order_history`
- Ajouter `totalDeliveryTime` dans l'interface `RestaurantNetworkStats`
- Ajouter `avgTotalDeliveryTime` dans l'interface `NetworkTotals`
- Calculer la moyenne par restaurant et pour le réseau

**Nouvelles propriétés** :
```typescript
interface RestaurantNetworkStats {
  // ... existing
  totalDeliveryTime: number | null; // Temps prépa+livraison moyen
}

interface NetworkTotals {
  // ... existing  
  avgTotalDeliveryTime: number | null;
}
```

### 2. Ajouter les seuils de performance pour le temps total

**Fichier** : `src/lib/performanceThresholds.ts`

**Changements** :
```typescript
PERFORMANCE_THRESHOLDS = {
  // ... existing
  totalDeliveryTime: {
    good: 30,      // ≤ 30 min = vert
    warning: 40,   // 30-40 min = orange, > 40 min = rouge
  },
};
```

- Mettre à jour la fonction `getMetricStatus` pour gérer `totalDeliveryTime` (lower is better)

### 3. Modifier les vignettes KPI

**Fichier** : `src/pages/Overview.tsx`

**Changements** :
- Ajouter une nouvelle ligne "Temps prépa+livraison" dans chaque vignette (Global, Uber Eats, Deliveroo)
- Utiliser l'icône `Truck` pour différencier du temps de préparation seul
- Navigation vers `/analytics/operations?tab=totalDelivery`

**Résultat visuel** :
```
┌─────────────────────────────────┐
│ Global                          │
│ ☆ Note moyenne          4.5/5  │
│ ⏱ Temps préparation   8 min 0s │
│ 🚚 Temps prépa+livraison 25min │  ← NOUVEAU
│ ↘ Commandes incorrectes  3.1%  │
│ ...                             │
└─────────────────────────────────┘
```

### 4. Remplacer la colonne "Prépa" par "Prépa+Livr" dans le tableau

**Fichier** : `src/components/overview/RestaurantComparisonTable.tsx`

**Changements** :
- Remplacer la colonne "Prépa" par "Prépa+Livr" (temps total)
- Utiliser `resto.totalDeliveryTime` au lieu de `resto.prepTime`
- Appliquer les seuils de couleur `totalDeliveryTime` 
- Mettre à jour le tri et le formatage

**Avant** :
| Restaurant | ... | Prépa | Inactiv. |
|------------|-----|-------|----------|
| CS Athis   | ... | 6m 33s | 0min    |

**Après** :
| Restaurant | ... | Prépa+Livr | Inactiv. |
|------------|-----|------------|----------|
| CS Athis   | ... | 24min      | 0min     |

---

## Résumé des fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/hooks/useNetworkStats.ts` | Fetch `total_prep_delivery_time_minutes`, ajouter `totalDeliveryTime` aux stats |
| `src/lib/performanceThresholds.ts` | Ajouter seuils `totalDeliveryTime` (30/40 min) |
| `src/pages/Overview.tsx` | Ajouter ligne "Temps prépa+livraison" dans les 3 vignettes |
| `src/components/overview/RestaurantComparisonTable.tsx` | Remplacer colonne "Prépa" par "Prépa+Livr" |

---

## Section technique

### Requête Supabase pour le temps total

```typescript
// Dans useNetworkStats.ts - nouvelle requête
const { data: totalDeliveryData } = useQuery({
  queryKey: ["network-stats-total-delivery", restaurantIds, startDateStr, endDateStr],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("order_history")
      .select("restaurant_id, total_prep_delivery_time_minutes")
      .gte("order_datetime", startDate.toISOString())
      .lte("order_datetime", endDate.toISOString())
      .in("restaurant_id", restaurantIds)
      .not("total_prep_delivery_time_minutes", "is", null);
    
    if (error) throw error;
    return data || [];
  },
  enabled: restaurantIds.length > 0,
});
```

### Calcul de la moyenne par restaurant

```typescript
// Temps prépa+livraison
const restoTotalDelivery = totalDeliveryData?.filter(h => h.restaurant_id === resto.id) || [];
const totalDeliveryTime = restoTotalDelivery.length > 0
  ? restoTotalDelivery.reduce((sum, h) => sum + Number(h.total_prep_delivery_time_minutes || 0), 0) / restoTotalDelivery.length
  : null;
```

### Formatage du temps (en minutes)

```typescript
const formatMinutesLong = (minutes: number | null): string => {
  if (minutes == null) return "—";
  const mins = Math.round(minutes);
  return `${mins}min`;
};
```

