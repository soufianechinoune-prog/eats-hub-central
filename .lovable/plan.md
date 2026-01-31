
# Correction de la source de données pour les rapports WhatsApp

## Diagnostic confirmé

Le taux d'erreur "vs 1.2% semaine dernière" est **faux** car le rapport utilise `daily_sales_uber` qui contient des **doublons** (2 lignes par jour).

| Métrique | Valeur correcte | Valeur buggée (doublons) |
|----------|-----------------|--------------------------|
| Commandes sem. précédente | 431 | 862 (×2) |
| Erreurs sem. précédente | 13 | 13 |
| Taux d'erreur | **3.02%** | **1.5%** ≈ 1.2% |

## Cause racine

Les deux edge functions `generate-weekly-report` et `generate-ai-report` utilisent la table `daily_sales_uber` :
```typescript
const { data: currentSales } = await supabase
  .from('daily_sales_uber')  // ← BUG : contient des doublons
  .select('revenue_ttc, order_count')
```

Alors que le dashboard utilise `daily_sales_uber_deduped` (vue SQL dédoublonnée).

## Solution

Modifier les deux edge functions pour utiliser `daily_sales_uber_deduped` au lieu de `daily_sales_uber`.

### Fichiers à modifier

**1. `supabase/functions/generate-ai-report/index.ts`**

Lignes 130-143 : Remplacer `daily_sales_uber` → `daily_sales_uber_deduped`

```typescript
// Avant
const { data: currentSales } = await supabase
  .from('daily_sales_uber')
  ...

const { data: prevSales } = await supabase
  .from('daily_sales_uber')
  ...

// Après
const { data: currentSales } = await supabase
  .from('daily_sales_uber_deduped')
  ...

const { data: prevSales } = await supabase
  .from('daily_sales_uber_deduped')
  ...
```

**2. `supabase/functions/generate-weekly-report/index.ts`**

Même modification aux mêmes endroits (requêtes sales pour semaine courante et précédente).

## Résultat attendu

Après correction, le rapport affichera :
- Semaine actuelle : **2.44%** (9 erreurs / 369 commandes)
- Semaine précédente : **~3.02%** (13 erreurs / 431 commandes)

Le message sera : "Erreurs: 2.44% (vs 3.0% semaine dernière)" → amélioration visible !

## Impact collatéral

Cette correction affectera aussi les autres KPIs basés sur le nombre de commandes :
- Variation du nombre de commandes (actuellement doublé)
- Variation du CA (actuellement basé sur données doublées)

Tous ces chiffres seront désormais cohérents avec le dashboard.
