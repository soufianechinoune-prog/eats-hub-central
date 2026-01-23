

# Limiter la date de fin à aujourd'hui pour l'année en cours

## Problème identifié

Quand vous sélectionnez "2026" comme année, le système définit :
- `startDate` = 1er janvier 2026
- `endDate` = 31 décembre 2026

Mais nous sommes le 23 janvier 2026, donc :
1. Il n'y a des données que du 1er au 23 janvier
2. Le graphique essaie de tracer toute l'année avec un seul mois de données
3. Le message "Pas assez de données" apparaît car la logique attend plus de points

## Solution

**Ajouter une logique de "cap à aujourd'hui"** quand `selectedYear === currentYear`.

### Fichiers à modifier

**1. `src/components/analytics/UberOneAnalysis.tsx` (lignes 102-106)**

Remplacer :
```typescript
default: // "year"
  return {
    startDate: startOfYear(new Date(selectedYear, 0, 1)),
    endDate: endOfYear(new Date(selectedYear, 0, 1)),
  };
```

Par :
```typescript
default: // "year"
  const yearStart = startOfYear(new Date(selectedYear, 0, 1));
  const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
  // Cap to today if current year
  const effectiveEnd = selectedYear === now.getFullYear() && yearEnd > now 
    ? now 
    : yearEnd;
  return {
    startDate: yearStart,
    endDate: effectiveEnd,
  };
```

**2. `src/hooks/useDataGranularity.ts` (lignes 66-70)**

Même correction pour assurer la cohérence globale :
```typescript
} else {
  // Full year view
  startDate = new Date(selectedYear, 0, 1);
  const yearEnd = new Date(selectedYear, 11, 31);
  // Cap to today if current year
  endDate = selectedYear === today.getFullYear() && yearEnd > today 
    ? today 
    : yearEnd;
  periodDays = differenceInDays(endDate, startDate) + 1;
}
```

---

## Résultat attendu

| Sélection | Avant | Après |
|-----------|-------|-------|
| 2026 (janvier) | 1 jan → 31 déc 2026 | 1 jan → 23 jan 2026 |
| 2025 | 1 jan → 31 déc 2025 | 1 jan → 31 déc 2025 (inchangé) |
| 2024 | 1 jan → 31 déc 2024 | 1 jan → 31 déc 2024 (inchangé) |

Cela garantit que :
- Les années passées restent complètes (12 mois)
- L'année en cours est limitée aux données réellement disponibles
- Le graphique affichera les points journaliers du 1er au 23 janvier

---

## Section technique

La logique de "cap" utilise une comparaison simple :
```typescript
const effectiveEnd = selectedYear === currentYear && theoreticalEnd > now 
  ? now 
  : theoreticalEnd;
```

Cette approche est déjà utilisée implicitement dans les modes "7d", "30d", et "current_month" qui prennent `today` comme référence. On applique simplement la même logique au mode "year".

