
# Aligner le calendrier de Temps de préparation sur Temps d'inactivité

## Objectif
Remplacer le sélecteur de période simple de la page "Comparaison Temps de préparation" par le composant `OverviewPeriodSelector` utilisé sur "Temps d'inactivité".

## Changements à effectuer

### Fichier : `src/pages/PrepTimeComparison.tsx`

1. **Imports à modifier**
   - Supprimer : `Select, SelectContent, SelectItem, SelectTrigger, SelectValue`
   - Supprimer : `Calendar` de lucide-react (déjà dans OverviewPeriodSelector)
   - Ajouter : `OverviewPeriodSelector, OverviewPeriodMode` depuis `@/components/overview/OverviewPeriodSelector`
   - Ajouter : `DateRange` depuis `react-day-picker`

2. **État local à refactoriser**
   - Remplacer `period` (type `PeriodType`) par `periodMode` (type `OverviewPeriodMode`)
   - Ajouter `selectedYear` / `setSelectedYear`
   - Ajouter `selectedMonth` / `setSelectedMonth`
   - Ajouter `customDateRange` / `setCustomDateRange`
   - Ajouter persistance localStorage comme Downtime

3. **Logique de calcul `dateRange`**
   Aligner sur le même switch que Downtime pour supporter :
   - `previous_week` : semaine précédente
   - `7d` : 7 derniers jours
   - `30d` : 30 derniers jours
   - `current_month` : mois en cours
   - `year` : année complète
   - `custom_month` : mois spécifique
   - `custom_range` : période personnalisée

4. **Header - Remplacer le Select**
   Supprimer :
   ```tsx
   <div className="flex items-center gap-2 text-sm ...">
     <Calendar className="h-4 w-4" />
     <span>{periodLabel}</span>
   </div>
   <Select value={period} onValueChange={...}>
     ...
   </Select>
   ```

   Par :
   ```tsx
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

5. **Sous-titre avec période**
   Ajouter le `periodLabel` dans le sous-titre comme Downtime :
   ```tsx
   <p className="text-muted-foreground text-sm">
     Analyse de {restaurantStats.length} restaurants | {periodLabel}
   </p>
   ```

## Résultat visuel attendu

| Élément | Avant | Après |
|---------|-------|-------|
| Sélecteur | Menu déroulant simple | Popover avec onglets |
| Options rapides | 3 (Semaine, Mois, Trimestre) | 4 (Semaine préc., 7j, 30j, Mois en cours) |
| Sélection mois | Non disponible | Grille de 12 mois avec navigation année |
| Sélection année | Non disponible | Grille des 5 dernières années |
| Période perso. | Non disponible | Calendrier double avec sélection de plage |

## Section technique

### Constante de stockage
```typescript
const STORAGE_KEY = "prep-time-comparison-state";
```

### État initial depuis localStorage
```typescript
const getInitialState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};
```

### Persistance
```typescript
useEffect(() => {
  const state = {
    periodMode,
    selectedYear,
    selectedMonth,
    customDateRange: customDateRange ? {
      from: customDateRange.from?.toISOString(),
      to: customDateRange.to?.toISOString(),
    } : undefined,
    isNetworkView,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}, [periodMode, selectedYear, selectedMonth, customDateRange, isNetworkView]);
```
