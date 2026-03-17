

## Correction : plafonner la date de fin à la dernière donnée disponible

### Problème
Quand on sélectionne "Mars 2026" ou "Année 2026", la date de fin dépasse la dernière donnée importée (ex: 15 mars), ce qui fausse les taux de disponibilité en comptant les jours sans data comme des jours offline.

### Solution
1. **Ajouter une query `latestDate`** : requêter la date la plus récente dans `hourly_availability` (comme `earliestDate` mais `descending`).
2. **Plafonner `end` à `latestDate`** : dans le `useMemo` qui calcule `dateRange`, après le switch, ajouter :
   ```typescript
   if (latestDate && end > latestDate) end = latestDate;
   ```
   Cela garantit que la plage ne dépasse jamais le dernier jour importé, quel que soit le retard d'import.

### Fichier modifié
- `src/pages/DowntimeComparison.tsx` : ajouter la query `latestDate` + cap dans le calcul de `dateRange`.

