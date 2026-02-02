

# Ajout de la métrique "Versement Net" dans l'Analyse Croisée

## Contexte

Les données de versement net (`net_payout + meal_voucher_amount`) sont **déjà disponibles** dans le flux de données :
- `useFinancesDrilldown` → retourne `net_payout`, `meal_voucher_amount`, `total_payout`
- `CrossDataAnalysisChart` → reçoit ces données et calcule déjà `netPayout + mealVoucher` pour la rentabilité

Aucun nouveau fetch n'est nécessaire !

## Modifications

| Fichier | Action |
|---------|--------|
| `src/components/analytics/CrossDataAnalysisChart.tsx` | Ajouter une 5ème métrique "Versement" |

## Détails techniques

### 1. Nouvelle métrique dans la configuration

```typescript
type MetricKey = "revenue" | "promos" | "profitability" | "uberOne" | "payout";

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; icon: typeof Euro }> = {
  revenue: { label: "CA", color: "hsl(var(--primary))", icon: Euro },
  promos: { label: "Promos", color: "hsl(25, 95%, 53%)", icon: Gift },
  profitability: { label: "Rentabilité", color: "hsl(142, 76%, 36%)", icon: Percent },
  uberOne: { label: "Uber One", color: "hsl(270, 70%, 55%)", icon: Crown },
  payout: { label: "Versement", color: "hsl(200, 80%, 50%)", icon: Wallet },  // Nouveau - bleu cyan
};
```

### 2. Données déjà agrégées

Le `chartData` calcule déjà :
```typescript
aggregated[key].netPayout += item.net_payout || 0;
aggregated[key].mealVoucher += item.meal_voucher_amount || 0;
// → On ajoute: aggregated[key].payout = netPayout + mealVoucher
```

### 3. Affichage sur le graphique

Le versement sera affiché comme une **barre** (même axe que CA et Promos) car c'est une valeur monétaire :

```typescript
{visibleMetrics.has("payout") && (
  <Bar
    yAxisId="left"
    dataKey="payout"
    name="Versement"
    fill="hsl(200, 80%, 50%)"
    // Opacité légère pour ne pas surcharger
    fillOpacity={0.7}
  />
)}
```

### 4. Tooltip enrichi

Ajout dans le tooltip :
```typescript
{visibleMetrics.has("payout") && (
  <p className="flex justify-between gap-4">
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />
      Versement :
    </span>
    <span className="font-medium text-cyan-600">
      {data?.payout?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
    </span>
  </p>
)}
```

### 5. Insights actualisés

Ajouter le versement total dans les badges d'insight :
```typescript
{visibleMetrics.has("payout") && (
  <Badge variant="outline" className="gap-1">
    <Wallet className="h-3 w-3 text-cyan-500" />
    Versement = {insights.totalPayout.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
  </Badge>
)}
```

## Résultat visuel

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Analyse Croisée CA / Promos / Rentabilité                          │
│                           [€ CA] [Promos] [% Rentab] [Uber One] [💰 Versement] │
├─────────────────────────────────────────────────────────────────────┤
│ Insight: Promos = 16%  │ -14 pts rentab │ Moy Uber One: 66% │ Versement = 45 230 € │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ████  ████  ████                (CA bleu + Versement cyan)        │
│   ████  ████  ████                                                  │
│   ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ← Promos orange                                │
│                       ~~~~~ ← Ligne rentabilité verte               │
└─────────────────────────────────────────────────────────────────────┘
```

## Avantages

- **Pas de fetch additionnel** : données déjà présentes
- **Cohérence** : utilise la formule standard `net_payout + meal_voucher_amount`
- **Clarté** : permet de visualiser l'écart entre CA et versement réel
- **Flexibilité** : toggle indépendant pour afficher/masquer

