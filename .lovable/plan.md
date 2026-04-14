

# Utiliser la table `orders` comme source unique pour les graphiques CA/Commandes/Panier Moyen

## Contexte
Actuellement, les graphiques "Revenus & Ventes" utilisent deux sources selon l'année :
- 2025+ : table `daily_sales_uber` (import "Sales Over Time")
- 2024 et avant : table `orders` (import "Paiements par commande")

L'utilisateur importe déjà les rapports par commande. Avoir un import séparé "Sales Over Time" est redondant.

## Solution
Supprimer la logique hybride et toujours utiliser les RPCs basées sur `orders` : `get_daily_revenue_from_orders` et `get_monthly_revenue_from_orders`.

## Modifications

### 1. `src/pages/Analytics.tsx`
- Supprimer la constante `SALES_OVER_TIME_START_YEAR`
- **Requête "current year"** (~ligne 573-646) : retirer les branches `if (useNewTable)` et ne garder que les appels `get_daily_revenue_from_orders` / `get_monthly_revenue_from_orders`
- **Requête "previous year"** (~ligne 822-916) : même chose, supprimer les branches `daily_sales_uber` et le mode `rollingPeriod` spécial qui utilisait `get_daily_sales_uber`. Le rolling period utilisera aussi `get_daily_revenue_from_orders` avec des dates décalées de 28 jours

### 2. Nettoyage optionnel
- Le type de rapport `sales_over_time` dans `reportImportConfig.ts` peut rester (l'import existe toujours côté edge function) mais n'est plus nécessaire pour ces graphiques

## Impact
- Les graphiques CA, Commandes, Panier Moyen se baseront sur les données déjà importées via les rapports par commande
- Plus besoin d'importer le rapport "Sales Over Time" pour voir ces graphiques
- La comparaison N-1 et rolling period fonctionnera de la même façon pour toutes les années

