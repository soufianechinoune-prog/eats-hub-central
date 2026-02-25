

# Bug : l'Overview affiche 12min d'inactivité au lieu de 6h14 pour Villeurbanne

## Diagnostic

Le problème est dans `useNetworkStats.ts`, lignes 348-349. La requête d'availability utilise `startDate.toISOString()` et `endDate.toISOString()` (timestamps UTC complets) au lieu des chaînes de date `startDateStr`/`endDateStr` utilisées par toutes les autres requêtes du hook.

Pour le 22/02/2026 en timezone Paris (UTC+1) :
- `startDate.toISOString()` = `"2026-02-21T23:00:00.000Z"`
- `endDate.toISOString()` = `"2026-02-21T23:00:00.000Z"`

La requête filtre donc `hour_start >= 2026-02-21T23:00:00Z AND hour_start <= 2026-02-21T23:00:00Z`, ce qui ne retourne que les enregistrements d'un SEUL créneau horaire (minuit heure Paris). Seuls 12 minutes d'offline apparaissent dans ce créneau, au lieu des 6h14 de la journée entière.

La page DowntimeComparison, elle, utilise `format(dateRange.start, "yyyy-MM-dd")` qui produit `"2026-02-22"` et couvre toute la journée correctement.

## Correction

### `src/hooks/useNetworkStats.ts`

Remplacer les lignes 348-349 pour utiliser `startDateStr` et `endDateStr` (date-only strings) avec des bornes de journée complètes, comme le font les autres requêtes du hook :

```typescript
// Avant (lignes 348-349)
.gte("hour_start", startDate.toISOString())
.lte("hour_start", endDate.toISOString())

// Après
.gte("hour_start", `${startDateStr}T00:00:00`)
.lte("hour_start", `${endDateStr}T23:59:59`)
```

Cela couvre toute la journée en UTC, ce qui est cohérent avec le comportement attendu et les autres requêtes du même hook.

### Fichier modifié
- `src/hooks/useNetworkStats.ts` (2 lignes)

### Impact
- Les KPI d'inactivité de l'Overview et du tableau comparatif afficheront les valeurs correctes pour toutes les périodes
- Aucun changement sur les autres métriques (elles utilisent déjà `startDateStr`/`endDateStr`)

