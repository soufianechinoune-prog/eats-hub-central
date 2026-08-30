# Réparer les vues Versements (table `payouts` vide)

## Diagnostic (confirmé par requêtes)

- `payouts` = **0 ligne**. Plus rien ne l'alimente : `parse-payment-report` ne fait qu'un UPDATE rétro-compat (éco-contribution), `parse-payout-summary` (ancien import CSV) n'est plus dans le pipeline API.
- Pages qui lisent `payouts` → affichent 0 € :
  - Finances / Versements : `get_monthly_payouts_summary`, `get_monthly_payouts_detail`, `get_yearly_payouts_detail` (toutes `FROM payouts`)
  - Overview vue "Payout" : `useOverviewData.ts` lit `payouts` côté client
- Pages qui recalculent depuis `orders` (+ `payout_adjustments`) → OK :
  - Finances & Frais Uber Eats : `get_orders_finance_summary/detail/yearly_detail`

## Option recommandée : repeupler `payouts` depuis `orders`

Plutôt que réécrire les 3 RPC + l'Overview, on régénère les lignes `payouts` (agrégat hebdo par restaurant, calé sur les cycles de versement Uber) à partir des données `orders` déjà importées — cohérent avec la règle "revenue unifiée sur orders".

### Étapes

1. **Migration de backfill** : fonction SQL `repopulate_payouts_from_orders(p_from date, p_to date)` qui, par restaurant × semaine de versement, insère/met à jour dans `payouts` :
   - `sales_incl_vat`, `sales_excl_vat`, promos, commission, `net_payout`, `order_count` depuis `orders`
   - montants pub / éco / ajustements / service_fee depuis `payout_adjustments`
   - `ON CONFLICT` upsert pour idempotence (ré-exécutable)
2. **Exécution** sur mai→août 2026 (périmètre du ré-import), puis sur tout l'historique si les totaux collent avec les CSV Uber.
3. **Pérennité** : à la fin de `parse-payment-report`, appeler `repopulate_payouts_from_orders` sur la fenêtre du rapport pour que `payouts` reste à jour à chaque import (au lieu du seul UPDATE éco-contribution).
4. **Vérification** : comparer pour mai/juin/juillet/août 2026 les totaux `payouts.net_payout` vs les versements réels Uber (écart attendu < 1 %), puis contrôle visuel des pages Finances + Overview.

## Alternative (si préférée) : réécrire les RPC sur `orders`

Remplacer `FROM payouts` par `FROM orders` dans les 3 RPC Finances + brancher l'Overview sur `get_orders_finance_summary`. Plus propre à terme (une seule source) mais touche plus de code et exige de rejouer les exports/PDF qui consomment ces RPC.

## Hors périmètre

- Réimport juin Tasty `service_fee` (~52 k€) déjà en file — indépendant.
- `get_profitability_*` / `get_delivery_pnl` : sources non confirmées comme liées à `payouts` (à vérifier pendant l'implémentation, ajustement si besoin).
