
# Correction du double comptage des erreurs

## Diagnostic confirmé

Le taux d'erreur affiché (8.3%) est exactement le double du taux réel Uber (4%) parce que le dashboard additionne les lignes `period_type = 'current'` ET `period_type = 'previous'` au lieu de ne compter que `current`.

| Source | Erreurs | Taux |
|--------|---------|------|
| Uber Eats Manager | 23 | 4% |
| Notre plateforme (buggée) | 46 | 8.3% |
| Après correction | 23 | ~4% |

## Solution en 2 parties

### Partie 1 : Corriger le dashboard (prioritaire)

Modifier `src/components/operations/OrderAccuracyDashboard.tsx` pour filtrer sur `period_type = 'current'` dans la requête de récupération des données.

**Fichier** : `src/components/operations/OrderAccuracyDashboard.tsx`

Ligne 128-133, ajouter le filtre :
```typescript
// Avant
let query = supabase
  .from("daily_order_accuracy")
  .select("*")
  .gte("date", effectiveDateRange.startDate)
  .lte("date", effectiveDateRange.endDate)
  .order("date", { ascending: true });

// Après
let query = supabase
  .from("daily_order_accuracy")
  .select("*")
  .eq("period_type", "current")  // NOUVEAU : ne compter que les données courantes
  .gte("date", effectiveDateRange.startDate)
  .lte("date", effectiveDateRange.endDate)
  .order("date", { ascending: true });
```

### Partie 2 : Nettoyer les doublons en base (optionnel mais recommandé)

Supprimer les lignes `previous` qui sont des doublons des lignes `current` sur les mêmes dates. Ces lignes n'auraient jamais dû exister car le CSV contenait une seule période de données.

Requête SQL à exécuter manuellement :
```sql
DELETE FROM daily_order_accuracy 
WHERE period_type = 'previous' 
  AND date >= '2026-01-12' 
  AND date <= '2026-01-18';
```

## Autres composants à vérifier

Le même filtre `period_type = 'current'` devrait être appliqué partout où on query `daily_order_accuracy` :

1. `ErrorRateEvolutionChart.tsx` - si applicable
2. `useNetworkStats.ts` - hook centralisé
3. Edge functions (`generate-weekly-report`, `generate-ai-report`) - déjà corrigées

## Résultat attendu

Après correction, le dashboard Opérations affichera :
- **Bonneuil** : 23 erreurs / ~570 commandes = **~4%** (identique à Uber)
- Les rapports WhatsApp utiliseront les mêmes chiffres cohérents
