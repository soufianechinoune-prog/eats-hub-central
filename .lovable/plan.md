

# Plan : Aligner le header de Comparaison Temps d'inactivité sur Comparaison Notes

## Objectif

Reproduire exactement le format du header de `RatingsComparison.tsx` sur `DowntimeComparison.tsx` :
- Toggle Épinglés/Réseau (deja present)
- Sélecteur de période avancé `OverviewPeriodSelector`
- Sous-titre avec période affichée

---

## Fichier à modifier

**`src/pages/DowntimeComparison.tsx`**

---

## Modifications

| Élément | Avant | Après |
|---------|-------|-------|
| Imports | `Select`, `Calendar`, `subMonths` | `OverviewPeriodSelector`, `subWeeks` |
| Type | `PeriodType = "week" \| "month" \| "quarter"` | Supprimé (utilise `OverviewPeriodMode`) |
| État | `period: PeriodType` | `periodMode`, `selectedYear`, `selectedMonth`, `customDateRange` |
| Header | Badge période + Select 3 options | `OverviewPeriodSelector` seul |
| Sous-titre | "Analyse de X restaurants" | "Analyse de X restaurants \| 26 janv. - 1 févr. 2026" |

---

## Détails techniques

### 1. Nouveaux imports

```typescript
// Supprimer
import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Ajouter
import { subWeeks } from "date-fns";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import type { DateRange } from "react-day-picker";
```

### 2. Supprimer le type `PeriodType` (ligne 17)

### 3. Nouvel état (remplace ligne 21-22)

```typescript
const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>("previous_week");
const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
const [isNetworkView, setIsNetworkView] = useState(false);
```

### 4. Nouvelle logique de calcul des dates (remplace lignes 24-43)

```typescript
const dateRange = useMemo(() => {
  const now = new Date();
  let start: Date;
  let end: Date;
  
  switch (periodMode) {
    case "previous_week": {
      const lastWeek = subWeeks(now, 1);
      start = startOfWeek(lastWeek, { weekStartsOn: 1 });
      end = endOfWeek(lastWeek, { weekStartsOn: 1 });
      break;
    }
    case "7d":
      start = subDays(now, 6);
      end = now;
      break;
    case "30d":
      start = subDays(now, 29);
      end = now;
      break;
    case "current_month":
      start = startOfMonth(now);
      end = now;
      break;
    case "year":
      start = new Date(selectedYear, 0, 1);
      end = new Date(selectedYear, 11, 31);
      break;
    case "custom_month":
      start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      end = endOfMonth(start);
      break;
    case "custom_range":
      if (customDateRange?.from && customDateRange?.to) {
        start = customDateRange.from;
        end = customDateRange.to;
      } else {
        start = subDays(now, 30);
        end = now;
      }
      break;
    default:
      start = subDays(now, 30);
      end = now;
  }
  
  return { start, end };
}, [periodMode, selectedYear, selectedMonth, customDateRange]);
```

### 5. Nouveau sous-titre (ligne 182-184)

```typescript
<p className="text-muted-foreground text-sm">
  Analyse de {restaurantStats.length} restaurants | {periodLabel}
</p>
```

### 6. Nouveau header (remplace lignes 188-209)

```typescript
<div className="flex items-center gap-3">
  <NetworkViewToggle
    isNetworkView={isNetworkView}
    onToggle={setIsNetworkView}
    pinnedCount={pinnedRestaurants?.length || 0}
    networkCount={allActiveRestaurants?.length || 0}
  />
  
  <OverviewPeriodSelector
    periodMode={periodMode}
    onPeriodModeChange={setPeriodMode}
    selectedYear={selectedYear}
    onYearChange={setSelectedYear}
    selectedMonth={selectedMonth}
    onMonthChange={setSelectedMonth}
    dateRange={customDateRange}
    onDateRangeChange={setCustomDateRange}
  />
</div>
```

### 7. Adapter le prop `period` passé à `DowntimeInsightsSection`

```typescript
// Ligne 219 - Le composant attend peut-être encore "period"
// Il faudra vérifier si ce composant doit être adapté ou si on peut passer periodMode
<DowntimeInsightsSection stats={restaurantStats} periodMode={periodMode} />
```

---

## Résultat attendu

1. Header aligné avec le format de "Comparaison Notes"
2. Toggle Épinglés/Réseau à gauche du sélecteur de période
3. Sélecteur de période avec les 4 onglets (Rapide, Mois, Année, Période perso.)
4. Sous-titre affichant le nombre de restaurants ET la période sélectionnée
5. Plus de badge de période séparé ni de Select basique

