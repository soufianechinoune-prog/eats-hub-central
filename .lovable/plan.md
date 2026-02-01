
# Ajouter le % Uber One à l'Analyse Croisée

## Objectif
Permettre de croiser le CA, les promos et la rentabilité avec le **% de clients Uber One** pour identifier les corrélations entre l'adhésion Uber One et les performances commerciales.

## Fonctionnalité

Un nouveau bouton toggle "% U1" (ou "Uber One") sera ajouté à côté des boutons existants (CA, Promos, Rentabilité). Quand activé, une nouvelle courbe violette affichera l'évolution du pourcentage de commandes Uber One sur l'axe droit (comme la rentabilité).

**Cas d'usage :**
- Voir si les jours à forte proportion Uber One ont un CA différent
- Analyser la corrélation entre promotions et attraction de clients Uber One
- Identifier si la rentabilité varie selon le % Uber One

## Aperçu visuel

```
[€ CA] [🎁 Promos] [% Rentabilité] [U1 Uber One] ← Nouveau bouton (violet/mauve)

Graphique:
- Barres bleues : CA
- Barres orange : Promos
- Courbe verte : Rentabilité (%)
- Courbe violette : % Uber One ← Nouvelle ligne
```

## Modifications techniques

### 1. CrossDataAnalysisChart.tsx

**Ajouter une nouvelle métrique :**
```typescript
type MetricKey = "revenue" | "promos" | "profitability" | "uberOne";

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; icon: typeof Euro }> = {
  revenue: { label: "CA", color: "hsl(var(--primary))", icon: Euro },
  promos: { label: "Promos", color: "hsl(25, 95%, 53%)", icon: Gift },
  profitability: { label: "Rentabilité", color: "hsl(142, 76%, 36%)", icon: Percent },
  uberOne: { label: "Uber One", color: "hsl(270, 70%, 55%)", icon: Crown }, // Violet/mauve
};
```

**Nouvelles props :**
```typescript
interface CrossDataAnalysisChartProps {
  data: DailyData[];
  previousData?: DailyData[];
  granularity: "daily" | "weekly" | "monthly";
  isLoading?: boolean;
  // NEW: Uber One data
  uberOneData?: Array<{
    date: string; // ou month selon granularité
    uberOnePercent: number;
    uberOneCount: number;
    totalOrders: number;
  }>;
}
```

**Fusionner les données :**
- Dans le `useMemo` qui prépare `chartData`, joindre les données Uber One par date/mois
- Ajouter un champ `uberOnePercent` à chaque point de données

**Ajouter la courbe au graphique :**
```tsx
{visibleMetrics.has("uberOne") && (
  <Line
    yAxisId="right"
    type="monotone"
    dataKey="uberOnePercent"
    name="uberOne"
    stroke={METRIC_CONFIG.uberOne.color}
    strokeWidth={2}
    strokeDasharray="5 5" // Ligne pointillée pour différencier de la rentabilité
    dot={{ fill: METRIC_CONFIG.uberOne.color, r: 3 }}
    activeDot={{ r: 5 }}
  />
)}
```

**Mettre à jour le Tooltip :**
Ajouter l'affichage du % Uber One avec le nombre de commandes correspondant.

### 2. AnalyticsCharts.tsx

**Importer et utiliser useUberOneStats :**
```typescript
import { useUberOneStats } from "@/hooks/useUberOneStats";

// Dans le composant, ajouter:
const { evolution: uberOneEvolution, isLoading: isUberOneLoading } = useUberOneStats({
  restaurantIds,
  startDate: profitStartDate,
  endDate: profitEndDate,
  periodMode: granularity === "daily" ? "month" : "year",
  platform: selectedPlatform,
});
```

**Transformer les données pour correspondre au format attendu :**
```typescript
const uberOneDataForChart = useMemo(() => {
  return uberOneEvolution?.map(e => ({
    date: e.month, // YYYY-MM-DD ou YYYY-MM
    uberOnePercent: e.uberOnePercent,
    uberOneCount: e.uberOneCount,
    totalOrders: e.totalOrders,
  })) || [];
}, [uberOneEvolution]);
```

**Passer les données au composant :**
```tsx
<CrossDataAnalysisChart
  data={revenueProfitabilityData}
  previousData={revenueProfitabilityPrevData || undefined}
  granularity={granularity}
  isLoading={isProfitabilityLoading}
  uberOneData={uberOneDataForChart} // Nouvelle prop
/>
```

### 3. Insights enrichis

Ajouter un insight sur la corrélation Uber One/CA :
```tsx
<Badge variant="outline" className="gap-1">
  <Crown className="h-3 w-3 text-purple-500" />
  Moy. Uber One: {avgUberOnePercent.toFixed(1)}%
</Badge>
```

Et calculer la différence de CA entre jours à fort/faible % Uber One pour en tirer un insight actionnable.

## Détails d'implémentation

### Source de données
- Les données Uber One proviennent de la table `order_history` via le hook `useUberOneStats`
- Le champ `uber_one` (boolean) indique si la commande est Uber One
- Le hook gère déjà la granularité jour/mois et la pagination

### Axe Y
- Le % Uber One partagera l'axe droit avec la rentabilité (les deux sont des %)
- Le domaine dynamique existant s'adaptera automatiquement

### Performance
- Les données Uber One sont chargées en parallèle des données financières
- Le cache React Query évite les requêtes redondantes

## Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `src/components/analytics/CrossDataAnalysisChart.tsx` | Nouveau toggle, nouvelle ligne, fusion des données |
| `src/components/analytics/AnalyticsCharts.tsx` | Appel à useUberOneStats, passage des données |

## Résultat attendu

L'utilisateur pourra activer/désactiver la courbe "Uber One" indépendamment des autres métriques, permettant des analyses croisées comme :
- CA + Uber One : impact de l'adhésion sur le volume
- Promos + Uber One : attraction des membres via les offres
- Rentabilité + Uber One : marge selon le type de client
