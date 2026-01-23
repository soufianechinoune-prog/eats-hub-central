
# Ajouter la granularité journalière pour l'évolution Uber One

## Problème identifié

Quand vous sélectionnez un mois spécifique (ex: "Décembre 2025"), le graphique "Évolution % Uber One" affiche "Pas assez de données" car :
1. Le hook `useUberOneStats` agrège **toujours** les données par mois (ligne 171 : `monthKey`)
2. Avec un seul mois sélectionné, il n'y a qu'un point de données
3. La condition `evolution.length > 1` (ligne 332) bloque l'affichage

## Solution

Adapter le hook pour basculer automatiquement en **granularité journalière** quand `periodMode === "month"` :

### Fichier 1 : `src/hooks/useUberOneStats.ts`

1. **Ajouter une interface pour l'évolution journalière** :
```typescript
export interface UberOneEvolutionData {
  month: string;        // Clé (YYYY-MM ou YYYY-MM-DD)
  monthLabel: string;   // Label affiché (ex: "15 déc" ou "Déc 24")
  uberOnePercent: number;
  uberOneCount: number;
  nonUberOneCount: number;
  totalOrders: number;
}
```

2. **Modifier le calcul de `evolution`** pour supporter la granularité journalière :
```typescript
const evolution = useMemo<UberOneEvolutionData[]>(() => {
  if (!rawData || rawData.length === 0) return [];

  // Utiliser granularité journalière en mode mois
  const useDaily = periodMode === "month";
  
  const dataMap: Record<string, { uberOne: number; nonUberOne: number }> = {};

  rawData.forEach((order) => {
    const date = new Date(order.order_datetime);
    const key = useDaily 
      ? date.toISOString().split('T')[0]  // YYYY-MM-DD
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;  // YYYY-MM

    if (!dataMap[key]) {
      dataMap[key] = { uberOne: 0, nonUberOne: 0 };
    }

    if (order.uber_one === true) {
      dataMap[key].uberOne++;
    } else {
      dataMap[key].nonUberOne++;
    }
  });

  const dayLabels = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

  return Object.entries(dataMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      let label: string;
      if (useDaily) {
        const d = new Date(key);
        label = `${d.getDate()} ${monthLabels[d.getMonth()].toLowerCase()}`;
      } else {
        const [year, monthNum] = key.split("-");
        label = `${monthLabels[parseInt(monthNum) - 1]} ${year.slice(2)}`;
      }

      const total = data.uberOne + data.nonUberOne;
      return {
        month: key,
        monthLabel: label,
        uberOnePercent: total > 0 ? (data.uberOne / total) * 100 : 0,
        uberOneCount: data.uberOne,
        nonUberOneCount: data.nonUberOne,
        totalOrders: total,
      };
    });
}, [rawData, periodMode]);
```

3. **Appliquer la même logique à `evolutionByRestaurant`** pour le mode détaillé par restaurant.

### Fichier 2 : `src/components/analytics/UberOneAnalysis.tsx`

Le composant n'a pas besoin de changement majeur car il utilise déjà `evolution` et `monthLabel` dynamiquement.

---

## Résultat attendu

| Période sélectionnée | Granularité | Points affichés |
|---------------------|-------------|-----------------|
| Année 2025 | Mensuelle | 12 points (Jan-Déc) |
| Décembre 2025 | Journalière | ~30 points (1-31 déc) |
| Novembre 2025 | Journalière | ~30 points (1-30 nov) |
| 7 derniers jours | Journalière | 7 points |
| 30 derniers jours | Journalière | 30 points |

---

## Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/hooks/useUberOneStats.ts` | Granularité adaptative (mensuelle vs journalière) basée sur `periodMode` |
| `src/components/analytics/UberOneAnalysis.tsx` | Aucune modification nécessaire (déjà dynamique) |

---

## Section technique

La logique de granularité sera basée sur :
```typescript
const useDaily = ["month", "7d", "30d", "previous_week", "current_month", "range"].includes(periodMode);
```

Cela garantit que toute période courte (moins d'un an) affiche des données journalières, tandis que la vue annuelle reste mensuelle pour la lisibilité.
