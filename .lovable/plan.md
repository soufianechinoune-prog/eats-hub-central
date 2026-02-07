
# Plan : Corriger la pagination des données de disponibilité

## Problème identifié

La page **Comparaison Temps d'inactivité** récupère seulement **1 000 lignes** alors qu'il y en a **13 608** pour la période (limite par défaut Supabase).

Conséquence : chaque restaurant ne reçoit qu'une fraction de ses données (ex: 11 lignes sur 144 pour Nantes Centre), faussant complètement le calcul de disponibilité.

| Restaurant | Données reçues | Données réelles |
|------------|----------------|-----------------|
| Nantes Centre | 11 lignes → calcul faux | 144 lignes → 99.0% |
| Nantes | 10 lignes → calcul faux | 144 lignes → 99.8% |

## Solution

Implémenter la **pagination** dans la requête de `DowntimeComparison.tsx`, identique à celle utilisée dans `OperationsAnalytics.tsx`.

---

## Fichier à modifier

**`src/pages/DowntimeComparison.tsx`**

---

## Modifications

### 1. Ajouter le format de date cohérent

Importer `format` depuis date-fns (déjà présent) et utiliser le format date string au lieu de `.toISOString()`.

### 2. Implémenter la pagination

Remplacer la requête simple par une boucle de pagination :

```typescript
const { data: availabilityData, isLoading } = useQuery({
  queryKey: ["downtime-comparison", selectedRestaurants?.map(r => r.id), dateRange.start, dateRange.end, isNetworkView],
  queryFn: async () => {
    if (!selectedRestaurants?.length) return [];
    
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("hourly_availability")
        .select("*")
        .in("restaurant_id", selectedRestaurants.map(r => r.id))
        .gte("hour_start", format(dateRange.start, "yyyy-MM-dd"))
        .lte("hour_start", format(dateRange.end, "yyyy-MM-dd'T'23:59:59"))
        .order("hour_start", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        hasMore = data.length === PAGE_SIZE;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    return allData;
  },
  enabled: !!selectedRestaurants?.length,
});
```

---

## Résultat attendu

| Avant | Après |
|-------|-------|
| 1 000 lignes max | Toutes les lignes (13 608+) |
| Nantes Centre: 84.7% (faux) | Nantes Centre: 99.0% (correct) |
| Données incomplètes | Parité avec la page Analytics |

Les deux pages afficheront désormais les mêmes taux de disponibilité pour la même période.
