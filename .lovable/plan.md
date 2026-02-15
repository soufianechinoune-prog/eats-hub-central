

# Utiliser les bonnes donnees pour la comparaison des commandes incorrectes

## Le probleme

La page "Comparaison Commandes incorrectes" lit les erreurs depuis la table `daily_order_accuracy` (importee depuis le dashboard Uber), qui ne couvre que **3 restaurants sur 14**. Pendant ce temps, la table `order_errors` (remplie par l'import CSV qu'on vient de corriger) contient les donnees pour **tous les 14 restaurants** epingles.

Resultat : 11 restaurants affichent "0 erreurs / 0 commandes" alors que les donnees existent.

## La solution

Modifier la page `InaccurateOrdersComparison.tsx` pour lire les erreurs depuis `order_errors` au lieu de `daily_order_accuracy`. Les commandes restent lues depuis `daily_sales_uber_deduped` (qui couvre tous les restaurants).

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `src/pages/InaccurateOrdersComparison.tsx` | Remplacer la requete `daily_order_accuracy` par une requete sur `order_errors`, et adapter le traitement des donnees |

## Detail technique

### Requete actuelle (ne couvre que 3 restaurants)

```text
daily_order_accuracy
  .eq("period_type", "current")
  .in("restaurant_id", ...)
  .gte("date", ...)
  .lte("date", ...)
```

### Nouvelle requete (couvre tous les restaurants)

```text
order_errors
  .in("restaurant_id", ...)
  .gte("error_date", dateRange.start)
  .lte("error_date", dateRange.end)
```

### Adaptation du traitement

- Compter les erreurs par `COUNT(DISTINCT uber_order_id)` par restaurant (au lieu de sommer `incorrect_orders_count`)
- Sommer `financial_impact` par restaurant (au lieu de `total_refund`)
- Grouper par jour de semaine via `error_date` pour la heatmap
- Categoriser par `error_category` pour le breakdown (au lieu des colonnes separees `missing_items_count`, etc.)
- Supprimer les references a `period_type`, `latestErrorDate`, et l'alerte "donnees incompletes" (plus pertinente avec cette source)

### Donnees confirmees en base

Les 14 restaurants epingles ont tous des donnees dans `order_errors` pour janvier 2026 :
- Athis-Mons : 676 erreurs
- Bonneuil : 549
- Juvisy : 376
- Saint-Denis : 138
- Argenteuil : 104
- Reims : 91
- Cergy : 71
- Toulouse, Roubaix : 48 chacun
- Nantes : 41
- Marseille Belsunce : 38
- Plombieres : 23
- Marseille : 19
- Nantes Centre : 17

