
# Correction du bug "Semaine précédente" dans les Erreurs de commandes

## Problème identifié

Quand tu sélectionnes **"Semaine précédente"** sur l'onglet Erreurs :
- **Comportement attendu** : Afficher les données du 19/01 au 25/01/2026 (5 jours de données)
- **Comportement actuel** : Affiche les données de tout janvier 2026 (37 enregistrements)

### Cause technique

Le composant `OrderAccuracyDashboard` calcule sa plage de dates (`effectiveDateRange`) sans reconnaître les modes rapides (`previous_week`, `7d`, `30d`, `current_month`).

```typescript
// Ligne 81-101 de OrderAccuracyDashboard.tsx
const effectiveDateRange = useMemo(() => {
  if (periodMode === "range" && dateRange) { ... }      // ✅ Géré
  if (periodMode === "month" && selectedMonth !== "all") { ... }  // ✅ Géré
  // ⚠️ PROBLÈME: "previous_week" tombe ici → année complète !
  return {
    startDate: `${selectedYear}-01-01`,
    endDate: `${selectedYear}-12-31`,
  };
}, [...]);
```

Alors que `OperationsAnalytics` transmet correctement le `dateRange` calculé par `useDataGranularity` pour ces modes, `OrderAccuracyDashboard` ne l'utilise pas correctement.

---

## Solution

Modifier `effectiveDateRange` dans `OrderAccuracyDashboard.tsx` pour reconnaître **tous les modes rapides** qui passent un `dateRange` :

### Avant (bugué)
```typescript
if (periodMode === "range" && dateRange) { ... }
```

### Après (corrigé)
```typescript
const isQuickPeriod = ["range", "previous_week", "7d", "30d", "current_month"].includes(periodMode);
if (isQuickPeriod && dateRange) { ... }
```

---

## Fichier à modifier

| Fichier | Modification |
|---------|--------------|
| `src/components/operations/OrderAccuracyDashboard.tsx` | Ligne 82 : Ajouter les modes `previous_week`, `7d`, `30d`, `current_month` à la condition qui utilise `dateRange` |

---

## Code de la correction

```typescript
// Ligne 81-101 : Modifier le calcul de effectiveDateRange
const effectiveDateRange = useMemo(() => {
  // Handle all quick period modes that have a dateRange
  const isQuickPeriod = ["range", "previous_week", "7d", "30d", "current_month"].includes(periodMode);
  
  if (isQuickPeriod && dateRange) {
    return {
      startDate: format(dateRange.start, "yyyy-MM-dd"),
      endDate: format(dateRange.end, "yyyy-MM-dd"),
    };
  }
  if (periodMode === "month" && selectedMonth !== "all") {
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const monthEnd = endOfMonth(monthStart);
    return {
      startDate: format(monthStart, "yyyy-MM-dd"),
      endDate: format(monthEnd, "yyyy-MM-dd"),
    };
  }
  // Year mode fallback
  return {
    startDate: `${selectedYear}-01-01`,
    endDate: `${selectedYear}-12-31`,
  };
}, [periodMode, dateRange, selectedYear, selectedMonth]);
```

---

## Résultat attendu

| Mode | Avant (bugué) | Après (corrigé) |
|------|---------------|-----------------|
| Semaine précédente | 37 enregistrements (tout janvier) | 5-7 enregistrements (semaine exacte) |
| 7 derniers jours | Année complète | 7 jours exacts |
| 30 derniers jours | Année complète | 30 jours exacts |
| Mois en cours | Année complète | Mois actuel uniquement |

Les KPIs (taux d'erreur, coût total, etc.) seront également corrects car ils dépendent de cette plage de dates filtrée.
