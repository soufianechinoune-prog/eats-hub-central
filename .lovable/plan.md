## Problème identifié

Sur le graphique **Rentabilité globale**, l'axe X s'arrête à mai alors qu'il devrait aller de janvier à décembre (comme Chiffre d'affaires / Commandes).

**Cause** : ligne 240 de `ProfitabilityComparisonChart.tsx` :
```ts
const allMonths = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
```
`dateRange.end` vaut aujourd'hui (16 mai 2026), donc `allMonths` ne génère que Jan→Mai. Recharts n'a tout simplement pas de points pour juin→décembre.

## Comportement attendu (identique aux 2 autres graphiques)

En mode `yearOverYear`, l'axe X doit couvrir **toute l'année courante** (Jan → Déc) :
- Courbe 2026 : présente Jan → Mai (data réelle), puis `null` → la ligne s'arrête visuellement.
- Courbe 2025 : présente Jan → Déc en entier.
- KPI `-1.6pp` : déjà recalculé sur la fenêtre comparable (Jan → Mai) par mon édit précédente. ✅

## Implémentation

**Un seul changement** dans `src/components/compare/ProfitabilityComparisonChart.tsx`, useMemo `chartData` ligne ~240 :

```ts
import { endOfYear } from "date-fns"; // ajouter à l'import existant

// ... à la place de :
const allMonths = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });

// utiliser :
const monthsEnd = comparisonMode === "yearOverYear"
  ? endOfYear(dateRange.start)
  : dateRange.end;
const allMonths = eachMonthOfInterval({ start: dateRange.start, end: monthsEnd });
```

Et ajouter `comparisonMode` aux dépendances du useMemo (ligne 322).

**Effets** :
- `chartData` contient 12 mois (Jan→Déc), valeurs à 0 pour juin→déc côté 2026.
- Mon `currentYearCutoffIndex` détecte mai comme dernier mois avec data (sales>0), donc :
  - `displayChartData` met `profitability = null` de juin à décembre → la courbe verte 2026 s'arrête à mai.
  - La courbe pointillée 2025 (`prevProfitability`) reste affichée jusqu'à décembre (les valeurs N-1 viennent de `prevDataByMonth` qui couvre toute l'année 2025).
  - Les KPIs restent calculés sur Jan→Mai (`scoped = chartData.slice(0, cutoff+1)`).

Aucun autre fichier touché. Pas de changement backend.
