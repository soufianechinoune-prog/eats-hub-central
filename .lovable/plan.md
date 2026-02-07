
# Plan : Implémenter le sélecteur de période avancé sur Comparaison des Notes

## Objectif

Remplacer le sélecteur simple (Select avec 3 options) par le composant `OverviewPeriodSelector` du Dashboard, qui offre :
- **Rapide** : Semaine précédente, 7 derniers jours, 30 derniers jours, Mois en cours
- **Mois** : Sélection d'un mois spécifique avec navigation par année
- **Année** : Sélection d'une année complète
- **Période perso.** : Calendrier avec plage de dates personnalisée

---

## Modifications

### Fichier : `src/pages/RatingsComparison.tsx`

| Section | Changement |
|---------|------------|
| Imports | Ajouter `OverviewPeriodSelector`, `OverviewPeriodMode`, `DateRange`, `subWeeks` |
| État | Remplacer `period` par `periodMode`, ajouter `selectedYear`, `selectedMonth`, `dateRange` |
| Logique | Adapter `dateRange` pour gérer tous les modes de période |
| UI | Remplacer le `Select` par `OverviewPeriodSelector` |
| Nettoyage | Supprimer les imports inutilisés (Recharts non utilisés) |

---

## Détails techniques

### 1. Nouveaux imports

```typescript
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import type { DateRange } from "react-day-picker";
import { subWeeks, startOfWeek, endOfWeek } from "date-fns";
```

### 2. Nouvel état

```typescript
// Remplacer l'ancien état
const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>("previous_week");
const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
```

### 3. Nouvelle logique de calcul des dates

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

### 4. Nouveau composant dans le header

```typescript
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
```

---

## Résultat attendu

1. Le sélecteur affiche un bouton avec l'icône calendrier et le libellé de la période active
2. Au clic, un popover s'ouvre avec 4 onglets (Rapide, Mois, Année, Période perso.)
3. Les données se rechargent automatiquement à chaque changement de période
4. Le label de période dans le sous-titre s'adapte (ex: "1 janv. - 31 janv. 2026")
