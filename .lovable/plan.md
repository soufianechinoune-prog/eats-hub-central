## Trois corrections sur le point benchmark

### 1. Position du point (axe X)
**Bug** : actuellement `x={selectedRestaurant.visits}` → le benchmark est verticalement aligné avec ton restaurant, ce qui donne l'illusion d'un même axe.
**Fix** : utiliser `x={benchmark.avg_visits}` → le point se place sur les **vraies visites moyennes** des concurrents (ex. ~85k visites pour Paris, pas 115k comme Tasty Crousty Saint Denis).

### 2. Tooltip au survol
**Bug** : le point est rendu via `<ReferenceDot>` qui n'a aucun tooltip Recharts.
**Fix** : remplacer par un `<Scatter>` dédié avec un dataset à 1 point ayant `isCompetitor: true`. Le `CustomTooltip` existant (lignes 207-229) gère déjà ce cas et affiche :
- "Concurrent local · PARIS"
- Visites moyennes
- Taux de conversion moyen
- Commandes moyennes
- Nombre de concurrents agrégés

### 3. Animation de transition
**Comportement souhaité** : quand tu cliques sur un restaurant, le point benchmark apparaît avec une animation douce depuis ta position vers la position des concurrents.
**Implémentation** : 
- Activer `isAnimationActive` sur le `<Scatter>` benchmark avec `animationDuration={800}` et `animationEasing="ease-out"`
- Le `key` du Scatter inclura `selectedRestaurantId` pour forcer une nouvelle animation à chaque changement
- Style visuel : cercle gris semi-transparent avec bordure plus marquée pour le distinguer des restaurants

## Changement technique

Un seul fichier : `src/components/analytics/ConversionScatterPlot.tsx`

```tsx
// 1. Ajouter un dataset benchmark dérivé
const benchmarkData = useMemo(() => {
  if (!showBenchmarkPoint) return [];
  return [{
    isCompetitor: true,
    visits: Number(benchmark.avg_visits),
    conversionRate: Number(benchmark.avg_conversion_rate),
    orders: Math.round(avg_visits * avg_conversion_rate / 100),
    city: benchmark.match_level === "city" ? benchmark.city : benchmark.postal_code,
    bubbleSize: 250,
  }];
}, [showBenchmarkPoint, benchmark]);

// 2. Remplacer ReferenceDot par un Scatter natif
{showBenchmarkPoint && (
  <Scatter
    key={`benchmark-${selectedRestaurantId}`}
    data={benchmarkData}
    fill="hsl(var(--muted-foreground))"
    fillOpacity={0.4}
    stroke="hsl(var(--muted-foreground))"
    strokeWidth={2}
    isAnimationActive
    animationDuration={800}
    animationEasing="ease-out"
  />
)}
```

## Résultat attendu

- Tu cliques sur **TASTY CROUSTY SAINT DENIS** (115k visites, 4.15%)
- Un cercle gris apparaît en glissant vers ses **vraies coordonnées** : ~85k visites (moyenne des 5 concurrents) et 2.58% (moyenne)
- Au survol : tooltip "Concurrent local · PARIS · 85k visites · 2.58% · ~2 200 commandes"