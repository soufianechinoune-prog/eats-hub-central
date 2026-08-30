# Option B — Versements recalculés depuis `orders`

Conclusion validée : on abandonne la table `payouts` (0 ligne) et on bascule toutes les vues Versements sur la logique `orders`, déjà éprouvée par `get_orders_finance_summary`.

## Réponses aux 4 points de contrôle (vérifiés en base)

1. **`orders.payout_date` existe bien** (type `date`), avec aussi `payout_reference_id` (l'ID du cycle Uber) et `net_payout`. Le regroupement par cycle est donc possible **sans changer le schéma**.
   - MAIS le remplissage est partiel sur les mois ré-importés :
     | mois | commandes | avec `payout_date` |
     |---|---|---|
     | avr. 2026 | 264 725 | 264 642 (100 %) |
     | mai 2026 | 293 426 | 281 128 (96 %) |
     | juin 2026 | 280 189 | 170 263 (61 %) |
     | juil. 2026 | 245 624 | 149 122 (61 %) |
     | août 2026 | 223 672 | 150 509 (67 %) |
   - → les trous correspondent aux stores dont le `PAYMENT_DETAILS_REPORT` n'est pas encore repassé (file de backfill en cours). Rien à corriger dans l'import : la colonne est bien mappée, il faut juste finir la file.
2. **3 RPC à rebrancher** : `get_monthly_payouts_summary`, `get_monthly_payouts_detail`, `get_yearly_payouts_detail` lisent toutes `payouts` → à réécrire sur `orders` (+ `payout_adjustments`). Idem pour l'Overview qui lit `payouts` en direct côté client (`useOverviewData.ts`).
3. **`get_delivery_pnl` et `get_profitability_*` ne touchent PAS `payouts`** : `get_delivery_pnl` part de `chataigne_orders`, `get_profitability_daily/monthly` partent de `restaurants` + `orders`. Rien à corriger de ce côté.
4. **Abandon de `payouts`** : aucune ré-alimentation en parallèle. On retire aussi l'UPDATE éco-contribution rétro-compat de `parse-payment-report` qui écrit encore dans cette table.

## Ce qu'on implémente

### 1. Réécriture des 3 RPC sur `orders`
Même schéma de sortie qu'aujourd'hui (aucun changement côté composants), mais agrégation :
- regroupement par `payout_date` (cycle Uber) et `restaurant_id`, filtré `AT TIME ZONE 'Europe/Paris'`
- ventes, promos, commission, titres-restaurant, `net_payout` depuis `orders`
- pub / éco-contribution / `service_fee` / ajustements depuis `payout_adjustments` joints sur `(restaurant_id, payout_date)`
- `SECURITY DEFINER`, `SET search_path = public`, isolation via `user_has_chain_access`

### 2. Overview
`useOverviewData.ts` : remplacer la requête directe `from("payouts")` par l'appel à la RPC versements, avec le même mapping de champs (`sales_incl_vat`, `net_payout`, par restaurant).

### 3. Nettoyage
- Retirer la Phase 3 « update payouts éco-contribution » de `parse-payment-report`.
- Marquer `payouts` et `payout_adjustments_snapshot_aug29` comme dépréciées (pas de DROP tout de suite, on garde le filet pendant 2-3 semaines).

### 4. Vérification
- Contrôle chiffré contre les CSV fournis : les 4 cycles Tasty Crousty Bobigny (06/07, 13/07, 20/07, 27/07) doivent tomber au centime sur `Montant total` = `net_payout` agrégé + ajustements du cycle.
- Contrôle visuel des pages Finances (mensuel + annuel) et Overview.
- Re-contrôle après la fin de la file de backfill, quand `payout_date` sera à ~100 % sur juin-août.

## Ordre d'exécution

1. Migration des 3 RPC → vérification chiffrée contre les CSV.
2. Bascule de l'Overview.
3. Nettoyage `parse-payment-report`.
4. Re-vérif finale une fois la file de backfill vidée.
