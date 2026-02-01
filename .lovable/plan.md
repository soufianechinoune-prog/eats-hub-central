

# Enrichissement du Rapport IA Global avec CA, Commandes et Inactivité

## Contexte

Le rapport IA actuel affiche :
- Notes (vs semaine précédente) ✅
- Taux d'erreur (vs semaine précédente) ✅

Mais il manque :
- **CA** de la semaine vs semaine précédente ❌
- **Nombre de commandes** de la semaine vs semaine précédente ❌
- **Temps d'inactivité tablette** de la semaine vs semaine précédente ❌

Ces données existent déjà dans la base (`daily_sales_uber_deduped` pour CA/commandes, `downtime_logs` pour inactivité) et sont partiellement récupérées mais non affichées.

## Modifications à apporter

### 1. Enrichir l'interface `WeeklyKPIs`

Ajouter les champs pour l'inactivité :

```typescript
interface WeeklyKPIs {
  // ... champs existants ...
  downtime_minutes: number;       // Total minutes inactivité semaine
  prev_downtime_minutes: number;  // Total minutes inactivité semaine précédente
  prev_order_count: number;       // Commandes semaine précédente (pour comparaison directe)
  prev_revenue: number;           // CA semaine précédente (pour comparaison directe)
}
```

### 2. Récupérer les données d'inactivité dans la boucle principale

Ajouter la requête sur `downtime_logs` pour la semaine courante ET la semaine précédente :

```typescript
// Fetch downtime for current week
const { data: downtimes } = await supabase
  .from('downtime_logs')
  .select('duration_minutes')
  .eq('restaurant_id', restaurantId)
  .gte('downtime_start', start_date)
  .lte('downtime_start', end_date + 'T23:59:59');

// Fetch downtime for previous week
const { data: prevDowntimes } = await supabase
  .from('downtime_logs')
  .select('duration_minutes')
  .eq('restaurant_id', restaurantId)
  .gte('downtime_start', prevStartStr)
  .lte('downtime_start', prevEndStr + 'T23:59:59');

const downtimeMinutes = (downtimes || []).reduce((sum, d) => sum + (d.duration_minutes || 0), 0);
const prevDowntimeMinutes = (prevDowntimes || []).reduce((sum, d) => sum + (d.duration_minutes || 0), 0);
```

### 3. Enrichir le prompt IA

Modifier `generateAIMessage()` pour inclure les 3 KPIs dans le prompt :

```typescript
const userPrompt = `Génère un rapport WhatsApp pour ce restaurant:

RESTAURANT: ${kpis.restaurant_name}
PRÉNOM MANAGER: ${kpis.manager_first_name}

📊 KPIs SEMAINE:
- CA: ${kpis.revenue.toFixed(0)}€ ${kpis.revenue_variation !== null ? `(${kpis.revenue_variation >= 0 ? '+' : ''}${kpis.revenue_variation.toFixed(0)}% vs ${kpis.prev_revenue.toFixed(0)}€ semaine précédente)` : ''}
- Commandes: ${kpis.order_count} ${kpis.order_variation !== null ? `(${kpis.order_variation >= 0 ? '+' : ''}${kpis.order_variation.toFixed(0)}% vs ${kpis.prev_order_count} semaine précédente)` : ''}
- Panier moyen: ${kpis.average_basket.toFixed(1)}€
- Note moyenne: ${kpis.average_rating !== null ? kpis.average_rating.toFixed(2) : '--'} ${ratingTrend} (vs ${kpis.prev_average_rating?.toFixed(2) || '--'} semaine précédente)
- Taux d'erreur: ${kpis.error_rate?.toFixed(1) || '--'}% ${errorTrend} (vs ${kpis.prev_error_rate?.toFixed(1) || '--'}% semaine précédente)
- Inactivité tablette: ${formatDowntime(kpis.downtime_minutes)} ${downtimeTrend} (vs ${formatDowntime(kpis.prev_downtime_minutes)} semaine précédente)
...`;
```

### 4. Mettre à jour le `systemPrompt` pour le rapport global

Enrichir les règles du système pour inclure CA, commandes et inactivité dans le rapport :

```typescript
RÈGLES:
1. Commence par saluer avec le prénom
2. Synthèse rapide avec indicateurs visuels:
   - ✅/❌ CA : [valeur]€ ([variation]% vs semaine dernière)
   - ✅/❌ Commandes : [nb] ([variation]% vs semaine dernière)
   - ✅/❌ Notes : [valeur] (vs [valeur précédente])
   - ✅/❌ Erreurs : [taux]% (vs [taux précédent]%)
   - ✅/❌ Inactivité : [Xh Ymin] (vs [Xh Ymin] semaine dernière)
3. [reste des règles]
```

### 5. Ajouter la fonction utilitaire `formatDowntime`

```typescript
function formatDowntime(minutes: number): string {
  if (minutes === 0) return '0';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h${mins}min`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
}
```

### 6. Déterminer les indicateurs de tendance

```typescript
// CA trend
const caTrend = kpis.revenue_variation !== null
  ? kpis.revenue_variation >= 0 ? '✅' : '❌'
  : '➖';

// Commandes trend
const orderTrend = kpis.order_variation !== null
  ? kpis.order_variation >= 0 ? '✅' : '❌'
  : '➖';

// Downtime trend (lower is better)
const downtimeTrend = kpis.prev_downtime_minutes > 0
  ? kpis.downtime_minutes <= kpis.prev_downtime_minutes ? '✅' : '❌'
  : kpis.downtime_minutes === 0 ? '✅' : '➖';
```

## Fichiers à modifier

| Fichier | Modifications |
|---------|--------------|
| `supabase/functions/generate-ai-report/index.ts` | Interface WeeklyKPIs, requêtes downtime, prompt enrichi |

## Résultat attendu

Le rapport IA affichera maintenant :

```
Salut Amar ! 👋

Al-hamdou liLlah cette semaine on a du vert sur les indicateurs clés ! 🚀

Voici le bilan pour CHICKEN STREET JUVISY-SUR-ORGE :

💰 CA : 8 234€ (+5% vs 7 842€ semaine dernière)
📦 Commandes : 344 (-3% vs 355 semaine dernière)
✅ Notes : 4.80 ⭐ (vs 4.41 la semaine dernière) - GROSSE PROGRESSION !
✅ Erreurs : 2.0% (vs 4.8% la semaine dernière)
⏸️ Inactivité : 45min (vs 1h20 semaine dernière) ✅

FOCUS SEMAINE 🎯 :
...
```

## Impact

- Les managers auront une vision complète des KPIs commerciaux et opérationnels
- La comparaison semaine/semaine permet d'identifier les tendances
- Les 3 nouveaux KPIs (CA, commandes, inactivité) complètent les notes et erreurs déjà présents

