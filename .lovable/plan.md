## Objectif

Afficher **3 colonnes Remboursements** côte à côte dans les tableaux Finances.

## Les 3 colonnes

| # | Colonne | Définition | Mars 2026 (Tasty Crousty) |
|---|---|---|---|
| 1 | **Remb. clients** | Montant brut envoyé aux clients (somme des lignes négatives, en absolu) | **~12 672 €** |
| 2 | **Annulations Uber** | Reprises Uber (somme des lignes positives qui annulent un remboursement) | **~10 142 €** |
| 3 | **Net à ma charge** | Remb. clients − Annulations Uber = ce qui sort vraiment de ma poche | **2 530 €** |

## Où ça s'applique

1. **Tableau du haut** (`ProfitabilityComparisonTable`) — la colonne actuelle "Remboursements" devient 3 colonnes groupées sous un header "Remboursements"
2. **Tableau du bas** (`OrdersAnalysisSection`, onglet "Par Jour") — mêmes 3 colonnes, mêmes valeurs (alimentées par la même source)
3. **Drilldown par restaurant** (`RestaurantDrilldownRow`) — mêmes 3 colonnes dans les onglets Jour / Heure
4. **Tooltip** sur chaque en-tête avec la définition courte
5. **Totaux mensuels** affichés pour les 3 colonnes
6. **Couleurs** : col 1 rouge atténué, col 2 vert atténué, col 3 rouge si > 0 / vert si < 0

## Détails techniques

- RPC `get_orders_finance_detail` : remplacer le champ `refund_incl_vat` unique par 3 champs :
  - `refund_to_customer` = `SUM(CASE WHEN refund_incl_vat < 0 THEN ABS(refund_incl_vat) ELSE 0 END)`
  - `refund_uber_cancellation` = `SUM(CASE WHEN refund_incl_vat > 0 THEN refund_incl_vat ELSE 0 END)`
  - `refund_net` = `refund_to_customer - refund_uber_cancellation`
- Idem dans les RPC du drilldown (`get_finances_daily_uber`, `get_finances_hourly_uber`) pour garder la cohérence
- Frontend :
  - `ProfitabilityComparisonTable.tsx` — header groupé "Remboursements" sur 2 niveaux, 3 sous-colonnes
  - `OrdersAnalysisSection.tsx` — exposer les 3 champs via `precomputedDailyRows`
  - `RestaurantDrilldownRow.tsx` — mapper les 3 champs
  - `useFinancesDrilldown.ts` — propager les 3 champs

## Validation

Pour Tasty Crousty / Mars 2026, les 3 tableaux doivent afficher exactement :
- Remb. clients : **12 672 €**
- Annulations Uber : **10 142 €**
- Net à ma charge : **2 530 €**

Totaux haut = totaux bas = drilldown.
