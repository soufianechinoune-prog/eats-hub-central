

# Meilleur format de labels hebdomadaires

## Probleme
Les labels "S1, S2, S3..." sont identiques d'un mois a l'autre — impossible de savoir de quelle periode il s'agit sans survoler le tooltip. En vue annuelle, c'est encore pire.

## Solution : labels avec dates integrees

Remplacer `S1`, `S2`... par un format compact incluant les dates :

- **Vue mois** : `03-09 mars`, `10-16 mars`, `17-23 mars`...
- **Vue annee** : `03-09 mar`, `10-16 mar`, `17-23 mar`... (mois abrege)
- **Vue range** : idem, avec mois abrege

Le format utilise `format(weekStart, 'd')` + `format(weekEnd, 'd MMM')` quand les deux dates sont dans le meme mois, et `format(weekStart, 'd MMM')` + `format(weekEnd, 'd MMM')` sinon.

Exemples :
- Meme mois : `3-9 mars`
- Cheval sur 2 mois : `27 fev - 5 mars`

## Fichiers modifies

### 1. `src/components/analytics/AnalyticsCharts.tsx` (ligne ~1277)
Remplacer :
```typescript
const weekLabel = `S${idx + 1}`;
```
Par un label dynamique du type `3-9 mar` ou `27 fev - 5 mar`.

### 2. `src/components/analytics/ConversionFunnelChart.tsx` (ligne ~310)
Meme correction dans `weeklyBreakdown` :
```typescript
label: `S${idx + 1}`,
```
Remplacer par le meme format de dates compact.

### 3. Format helper
Creer une petite fonction utilitaire `formatWeekLabel(weekStart, weekEnd)` reutilisable, soit inline soit dans un fichier utils.

## Resultat attendu
- Axe X du graphique : `3-9 mar | 10-16 mar | 17-23 mar | 24-30 mar`
- Pills du funnel : `3-9 mar | 10-16 mar | ...`
- Tooltip inchange (deja correct avec la plage complete)

