
# Correction du bug "Semaine précédente" - Operations Analytics

## Problème identifié

Le bouton "Semaine précédente" affiche les données de l'année entière au lieu de la semaine sélectionnée.

**Comparaison des screenshots :**
| Mode | Enregistrements | Erreurs | Commandes |
|------|-----------------|---------|-----------|
| Plage manuelle 19/01-25/01 | 10 | 26 | 724 |
| "Semaine précédente" | 70 | 176 | 3721 |

## Cause technique

Dans `OperationsAnalytics.tsx`, le calcul de `dateRange` utilise `contextDateRange` du contexte global. Or, quand on sélectionne un mode rapide comme "Semaine précédente" :

- `periodMode` → devient `"previous_week"` (correct)
- `contextDateRange` → **reste `undefined`** (le context ne met pas automatiquement à jour ces dates)

Le code tombe alors dans le fallback qui retourne l'année entière :
```typescript
// Fallback actuel - retourne toute l'année!
const start = new Date(selectedYear, 0, 1);
const end = new Date(selectedYear, 11, 31);
```

## Solution proposée

Utiliser le hook `useDataGranularity` existant qui calcule CORRECTEMENT les dates pour tous les modes (y compris `previous_week`, `7d`, `30d`, etc.) au lieu de dépendre de `contextDateRange`.

## Modifications

### Fichier : `src/components/analytics/OperationsAnalytics.tsx`

1. **Importer le hook `useDataGranularity`**

2. **Remplacer le calcul manuel de `dateRange`** par l'utilisation du hook :
   - Avant : logique conditionnelle avec fallback bugué
   - Après : utilisation de `startDate` et `endDate` du hook qui gère tous les modes

3. **Simplifier le passage des props à `OrderAccuracyDashboard`** :
   - Le `dateRange` sera toujours calculé correctement, peu importe le mode

### Changement de code (approximatif)

```typescript
// AVANT (bugué)
const dateRange = useMemo(() => {
  const usesContextRange = (periodMode === "previous_week" || ...) &&
    contextDateRange?.from && contextDateRange?.to;
  if (usesContextRange) {
    return { start: contextDateRange!.from!, end: contextDateRange!.to! };
  }
  // Fallback année entière - BUG!
  return { start: new Date(selectedYear, 0, 1), end: new Date(selectedYear, 11, 31) };
}, [...]);

// APRÈS (corrigé)
const { startDate, endDate } = useDataGranularity({
  periodMode,
  selectedYear,
  selectedMonth,
  dateRange: contextDateRange,
});

const dateRange = useMemo(() => ({
  start: startDate,
  end: endDate,
}), [startDate, endDate]);
```

## Résultat attendu

Après correction, avec le même restaurant et la même semaine :
- "Semaine précédente" affichera **les mêmes données** que la sélection manuelle de la même période
- Nombre d'enregistrements cohérent (~10 pour une semaine)
- KPIs identiques entre les deux méthodes de sélection

## Fichiers modifiés

| Fichier | Modifications |
|---------|---------------|
| `src/components/analytics/OperationsAnalytics.tsx` | Import `useDataGranularity`, remplacer le calcul de `dateRange` |

## Tests de validation

1. Sélectionner "CHICKEN STREET ATHIS-MONS" uniquement
2. Choisir "Semaine précédente" (qui correspond au 20/01-26/01)
3. Aller dans l'onglet "Erreurs"
4. Comparer avec une sélection manuelle de la même période
5. Les deux doivent afficher les mêmes KPIs (même nombre d'erreurs, même taux)
