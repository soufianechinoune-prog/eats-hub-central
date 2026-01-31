

# Correction de l'incohérence des données d'erreurs dans les rapports WhatsApp

## Diagnostic confirmé

Le rapport WhatsApp affiche **0%** alors que la plateforme affiche **9,5%** parce qu'ils utilisent **deux tables différentes** :

| Composant | Table utilisée | Données Jan 12-18 Juvisy |
|-----------|----------------|--------------------------|
| Dashboard Opérations | `daily_order_accuracy` | ✅ 19+ erreurs |
| Rapport WhatsApp | `order_errors` | ❌ 0 erreurs |

Les tables sont alimentées par des imports différents :
- `daily_order_accuracy` ← Rapport "Résumé erreurs" (données agrégées)
- `order_errors` ← Rapport "Commandes inexactes" (données détaillées)

## Solution

Modifier `generate-weekly-report` pour utiliser `daily_order_accuracy` (même source que le dashboard) au lieu de `order_errors`.

## Modification technique

### Fichier à modifier
`supabase/functions/generate-weekly-report/index.ts`

### Avant (lignes 132-141)
```typescript
// Fetch order errors for current week
const { data: errors } = await supabase
  .from('order_errors')
  .select('id')
  .eq('restaurant_id', restaurantId)
  .gte('error_date', start_date)
  .lte('error_date', end_date + 'T23:59:59');

const errorCount = errors?.length || 0;
const errorRate = orderCount > 0 ? (errorCount / orderCount) * 100 : null;
```

### Après
```typescript
// Fetch order accuracy from daily aggregated data (same source as dashboard)
const { data: accuracyData } = await supabase
  .from('daily_order_accuracy')
  .select('incorrect_orders_count')
  .eq('restaurant_id', restaurantId)
  .eq('period_type', 'current')
  .gte('date', start_date)
  .lte('date', end_date);

const errorCount = accuracyData?.reduce((sum, d) => sum + (d.incorrect_orders_count || 0), 0) || 0;
const errorRate = orderCount > 0 ? (errorCount / orderCount) * 100 : null;
```

### Même modification pour la semaine précédente

Ajouter une requête pour récupérer les erreurs de la semaine précédente :

```typescript
// Fetch previous week order accuracy
const { data: prevAccuracyData } = await supabase
  .from('daily_order_accuracy')
  .select('incorrect_orders_count')
  .eq('restaurant_id', restaurantId)
  .eq('period_type', 'current')
  .gte('date', prevStartStr)
  .lte('date', prevEndStr);

const prevErrorCount = prevAccuracyData?.reduce((sum, d) => sum + (d.incorrect_orders_count || 0), 0) || 0;
const prevErrorRate = prevOrderCount > 0 ? (prevErrorCount / prevOrderCount) * 100 : null;
```

### Mise à jour de l'interface WeeklyKPIs

Ajouter les champs pour la comparaison :
```typescript
interface WeeklyKPIs {
  // ... existing fields
  error_rate: number | null;
  error_count: number;
  prev_error_rate: number | null;  // Nouveau
  prev_error_count: number;         // Nouveau
}
```

## Résultat attendu

| Période | Avant (bugué) | Après (corrigé) |
|---------|---------------|-----------------|
| Semaine courante (Jan 19-25) | 2.03% (7 erreurs) | 2.03% (identique) |
| Semaine précédente (Jan 12-18) | 0% | ~9.5% (19+ erreurs) |

Les rapports WhatsApp utiliseront désormais la même source de données que le dashboard Opérations, garantissant la cohérence des chiffres affichés.

