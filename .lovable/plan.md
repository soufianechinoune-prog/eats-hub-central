
# Fix : graphique "Rentabilité globale" trop lent à charger

## Problème

Le graphique appelle `useFinancesDrilldown({ granularity: 'daily' })` qui télécharge **toutes les commandes individuelles** (ex: 3000+ lignes pour 1 mois) puis les agrège côté client par date. Pour 2 restaurants sur 3 mois, ça peut représenter 5000-10000 requêtes paginées.

Or, il existe déjà une RPC `get_profitability_daily` qui fait exactement cette agrégation **côté serveur** en une seule requête SQL ultra-rapide (~100ms).

## Solution

Remplacer l'appel `useFinancesDrilldown` dans `FinancesSection` par un appel direct à la RPC `get_profitability_daily`, qui retourne déjà les données agrégées par jour et par restaurant.

## Modifications

### 1. `src/components/analytics/FinancesSection.tsx`

- Remplacer l'appel `useFinancesDrilldown({ granularity: 'daily' })` par un `useQuery` appelant `supabase.rpc('get_profitability_daily', { ... })`
- La RPC retourne : `restaurant_id, day, sales, payout, net_payout, meal_voucher, orders_count, item_promo_incl_vat`
- Mapper ces champs vers le format `DailyFinanceData` attendu par `ProfitabilityComparisonChart`
- Construire `dailyDataByRestaurant` à partir du même résultat (groupé par `restaurant_id`)
- Supprimer l'import `useFinancesDrilldown` devenu inutile dans ce fichier

### Mapping RPC → format chart

```
sales → sales_incl_vat
net_payout → net_payout  
meal_voucher → meal_voucher_amount
orders_count → order_count
item_promo_incl_vat → promo_incl_vat
payout - net_payout → uber_fee_incl_vat (approximation)
```

## Résultat

- Chargement du graphique en **< 1 seconde** au lieu de 10-30 secondes
- Aucun impact sur les autres onglets (Par Jour, Par Commande, etc.) qui continuent d'utiliser `useFinancesDrilldown`
