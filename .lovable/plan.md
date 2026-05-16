## Objectif

Appliquer la même logique de "cutoff" au graphique **Rentabilité globale** (`ProfitabilityComparisonChart.tsx`) que celle déjà en place sur Chiffre d'Affaires / Commandes / Panier moyen.

En vue annuelle (2026 vs 2025), la courbe 2026 doit s'arrêter au dernier mois (ou jour) avec data réelle, la courbe 2025 reste affichée en entier, et la **variation (`-1.6pp`)** doit être recalculée sur la **même fenêtre comparable** (Jan → dernier mois 2026).

## Comportement attendu

1. Détecter le dernier index avec data réelle en année courante (`sales > 0` ou `orders > 0` ou `profitability !== null`).
2. Courbe 2026 : `profitability = null` après le cutoff → Recharts coupe proprement la ligne.
3. Courbe 2025 (`prevProfitability`) : inchangée, affichée en entier.
4. KPIs `totalProfitability`, `prevTotalProfitability`, `variation` : recalculés uniquement sur les mois ≤ cutoff.
5. Indicateur discret sous le titre : `· comparable Jan → Mai` quand un cutoff est appliqué.
6. Actif uniquement si `comparisonMode === "yearOverYear"`. Le mode `rollingPeriod` reste inchangé.

## Implémentation

Fichier unique : `src/components/compare/ProfitabilityComparisonChart.tsx`

### 1. Cutoff (nouveau `useMemo` après `chartData`)

```ts
const currentYearCutoffIndex = useMemo(() => {
  if (comparisonMode !== "yearOverYear") return -1;
  let last = -1;
  chartData.forEach((d, i) => {
    if ((d.sales || 0) > 0 || (d.orders || 0) > 0) last = i;
  });
  // Ne s'applique que s'il manque au moins une période en année courante
  const hasMissing = chartData.some((d, i) => i > last);
  return hasMissing ? last : -1;
}, [chartData, comparisonMode]);
```

### 2. Data affichée (courbe tronquée)

```ts
const displayChartData = useMemo(() => {
  if (currentYearCutoffIndex < 0) return chartData;
  return chartData.map((d, i) => i > currentYearCutoffIndex
    ? { ...d, profitability: null, trBonus: null }
    : d);
}, [chartData, currentYearCutoffIndex]);
```

Remplacer `chartData` par `displayChartData` dans les `LineChart` / `BarChart` (lignes ~1107-1153 et autres références dans le rendu graphique).

### 3. KPIs sur fenêtre comparable

Dans le `useMemo` ligne 428, calculer les sommes **uniquement** sur `chartData.slice(0, currentYearCutoffIndex + 1)` quand `currentYearCutoffIndex >= 0`. Sinon, comportement actuel. Cela aligne `totalProfitability` (2026 partiel) et `prevTotalProfitability` (2025 sur la même fenêtre) → la `variation` devient pertinente.

### 4. Indicateur visuel

Sous le titre "Rentabilité globale", ajouter (uniquement si cutoff actif) :
```
· comparable Jan → {nom du dernier mois}
```

### 5. Export CSV

L'export ligne 639 boucle sur `chartData` → conserver `chartData` complet pour l'export (utilisateur peut vouloir voir les zéros), OU exporter `displayChartData`. À confirmer si besoin — par défaut on garde `chartData`.

## Points techniques

- Aucune modif backend / RPC.
- Aucun impact sur le mode `rollingPeriod`.
- Cohérent avec le pattern déjà appliqué dans `AnalyticsCharts.tsx`.
