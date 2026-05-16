## Problème

Quand on est en vue annuelle (ex: 2026 vs 2025), la courbe 2026 affiche `0` pour les mois sans data (juin → décembre), et le KPI de variation (`-68%`) compare **l'année entière 2026 (incomplète)** à **l'année entière 2025 (complète)** — donc faux.

## Comportement attendu

1. **Détecter le cutoff** = dernière période (mois ou jour) avec data réelle en année courante (`revenue > 0` ou `orders > 0`).
2. **Courbe année courante** : s'arrête au cutoff (pas de points à 0 après).
3. **Courbe année précédente** : reste affichée en entier (référence visuelle).
4. **KPI de variation** : compare uniquement la **même fenêtre** (Jan → cutoff) sur les deux années → pourcentage comparable.

Appliqué aux **3 graphiques d'évolution** : Chiffre d'Affaires, Commandes, Panier Moyen — tous dans `AnalyticsCharts.tsx`.

Uniquement actif en mode `comparisonMode === "yearOverYear"`. Le mode `rollingPeriod` n'est pas concerné.

## Implémentation

Dans `src/components/analytics/AnalyticsCharts.tsx` :

### 1. Calculer le cutoff

Nouveau `useMemo` après `aggregatedRevenueData` :
```ts
const currentYearCutoffIndex = useMemo(() => {
  if (comparisonMode !== "yearOverYear") return -1;
  let last = -1;
  aggregatedRevenueData.forEach((d, i) => {
    if ((d.revenue || 0) > 0 || (d.orders || 0) > 0) last = i;
  });
  return last; // -1 si aucune data
}, [aggregatedRevenueData, comparisonMode]);
```

### 2. Filtrer les KPIs (lignes 1834-1868)

Ne sommer `totalRevenue`, `totalOrders`, `prevTotalRevenue`, `prevTotalOrders` (et conversion, fees) **que jusqu'à `currentYearCutoffIndex` inclus** quand celui-ci est ≥ 0. Sinon, comportement actuel inchangé.

### 3. Tronquer la courbe année courante

Dans les `chartData` passés aux `LineChart` / `BarChart` (Revenue ~ligne 2200, Commandes ~ligne 2700, Panier moyen ~ligne 2900), remplacer `revenue` / `orders` / `avgBasket` par `null` (ou `undefined`) pour les index > cutoff. Recharts saute proprement les `null` → la ligne s'arrête, l'année N-1 continue.

### 4. Indicateur visuel (optionnel mais recommandé)

Ajouter une mention discrète sous le titre quand un cutoff est appliqué :
> *Comparaison sur période comparable (Jan → Mai)*

Et garder le suffixe existant `(2026 vs 2025)` tel quel.

## Points techniques

- Le cutoff est **calculé à partir de la data agrégée déjà filtrée** (par plateforme, restaurants sélectionnés, période). Pas besoin de requête SQL supplémentaire.
- En vue mensuelle (granularity = month, par défaut), le cutoff est un **index de mois**. En vue journalière (drill-down), c'est un **index de jour**.
- `hasPrevData` n'a pas besoin d'évoluer : on continue d'afficher la courbe N-1 entière.
- Aucune modif backend / RPC nécessaire.

## Fichiers touchés

- `src/components/analytics/AnalyticsCharts.tsx` (seul fichier modifié)
