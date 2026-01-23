
# Adapter l'échelle du graphique Évolution % Uber One

## Problème

L'axe Y est fixé de 0% à 100%, mais les données varient entre ~55% et ~68%. Les variations sont invisibles car l'amplitude est de seulement 10-15 points sur une échelle de 100.

## Solution

Calculer dynamiquement le domaine de l'axe Y basé sur les valeurs min/max des données, avec un arrondi à la dizaine et une marge de 5%.

### Fichier à modifier : `src/components/analytics/UberOneAnalysis.tsx`

**1. Ajouter le calcul du domaine dynamique (avant le return)**

```typescript
// Calcul du domaine Y dynamique pour le graphique d'évolution
const evolutionYDomain = useMemo(() => {
  if (evolution.length === 0) return [0, 100];
  
  const values = evolution.map(e => e.uberOnePercent);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  
  // Arrondir à la dizaine inférieure/supérieure avec marge de 5%
  const range = maxVal - minVal;
  const margin = Math.max(range * 0.1, 5); // Au moins 5 points de marge
  
  const yMin = Math.max(0, Math.floor((minVal - margin) / 10) * 10);
  const yMax = Math.min(100, Math.ceil((maxVal + margin) / 10) * 10);
  
  return [yMin, yMax];
}, [evolution]);
```

**2. Remplacer le domain fixe par le domaine dynamique (ligne 222)**

Avant :
```typescript
<YAxis
  domain={[0, 100]}
  ...
/>
```

Après :
```typescript
<YAxis
  domain={evolutionYDomain}
  ...
/>
```

---

## Résultat attendu

| Avant | Après |
|-------|-------|
| Axe Y : 0% - 100% | Axe Y : 50% - 70% (dynamique) |
| Courbe quasi-plate | Variations visibles |
| Difficile de voir les tendances | Tendance haussière claire (+6 pts) |

---

## Fichier modifié

| Fichier | Modification |
|---------|--------------|
| `src/components/analytics/UberOneAnalysis.tsx` | Domaine Y dynamique basé sur min/max des données |
