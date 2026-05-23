Cibles confirmées : 5 commandes sur **TASTY CROUSTY PARIS 18** entre le 14 et 17 janvier 2026.
- `#D0954` 14/01 20:50 — refund -11,60 €
- `#140BC` 16/01 20:15 — refund -8,25 €
- `#D4F4B` 17/01 16:39 — refund 0 €
- `#E3ED5` 17/01 19:55 — refund -1,80 €
- `#E0A71` 17/01 20:05 — refund -11,60 €

(Si tu voulais bien Argenteuil, dis-le moi — ces 5 IDs n'y existent simplement pas.)

## Contenu du fichier Excel

**Fichier** : `/mnt/documents/refunds_tasty_paris18_janv2026.xlsx`, 5 onglets — un par source de données — pour que tu voies **exactement** ce qu'on a et ce qu'on n'a pas.

### Onglet 1 — `orders` (1 ligne par commande, ~50 colonnes)
Tout le contenu brut de la table `orders` pour les 5 commandes :
- Identifiants : `uber_order_id`, `uber_flow_id` (UUID complet), `id` interne, `payout_reference_id`, URLs factures Uber/client/coursier
- Timing : `order_datetime`, `payout_date`, `report_import_date`, `data_source`
- Contexte : `order_channel` (iOS/Android/Web), `fulfillment_type`, `uber_one_status`, `loyalty_id`, `payment_method`
- **Bloc CA** : `sales_excl_vat`, `vat_1/2/3_sales`, `sales_incl_vat`, `order_total_incl_vat`
- **Bloc Remboursement** : `refund_excl_vat`, `vat_1/2/3_refund`, `refund_incl_vat`, `eco_contribution_refund`
- **Bloc Promo article** : `item_promo_excl_vat`, `vat_1/2/3_item_promo`, `item_promo_incl_vat`, `marketing_fee_adjustment`
- **Bloc Promo livraison** : `delivery_promo_excl/incl_vat`, `vat_delivery_promo`
- **Bloc Frais Uber** : `uber_fee_before_promo_excl_vat`, `uber_fee_promo_excl_vat`, `uber_fee_after_promo_excl/incl_vat`, `vat_uber_fee`, `offer_usage_fee`, `vat_offer_usage_fee`
- **Bloc Livraison** : `delivery_cost_excl/incl_vat`, `vat_delivery_cost`, `delivery_fee_gain`, `merchant_delivery_fee_*`
- **Bloc Net** : `gross_amount`, `net_amount`, `net_payout`, `tip_amount`, `tax_amount`, `vat_adjustment`, `other_payments_*`, `meal_voucher_*`, `bag_fee`, `packaging_fee`, `price_adjustment_*`

### Onglet 2 — `order_items` (n lignes par commande)
Détail article par article :
- `item_title`, `category`, `requested_quantity`, `final_quantity`, `unit_price`, `total_price`
- CA HT/TVA/TTC par article (`sales_excl_vat`, `vat_1/2/3_sales`, `sales_incl_vat`)
- **Refund par article** : `refund_excl_vat`, `vat_1/2/3_refund`, `refund_incl_vat` → permet de voir **quel article exact** a été remboursé sur chaque commande
- Promo article, modifiers (JSON)

### Onglet 3 — `order_errors` (raison du refund)
Pour chaque commande, lignes de `order_errors` si présentes :
- `error_type`, `error_category`, `error_description` (raison Uber)
- `item_title`, `item_id` (article incriminé)
- `financial_impact`, `order_amount`
- `customer_id`, `customer_name`, `order_channel`, `refund_datetime`

### Onglet 4 — `order_history` (timing opérationnel)
- `order_status`, `delivery_status`, `cancelled_by`, `multi_order_type`, `brand`
- Timing complet : `merchant_accept_time`, `initial_prep_time_minutes`, `extended_prep_time_minutes`, `courier_arrival_time`, `courier_departure_time`, `delivery_time`, `total_delivery_time_minutes`, `courier_wait_time_minutes`, `avoidable_wait_time_minutes`, `customer_wait_time_minutes`
- `item_count`, `order_amount`, `uber_one`

### Onglet 5 — `delivery_stats` (si présent)
`delivery_status`, `delay_minutes`, `estimated_time_minutes`, `total_time_minutes`, `delivery_time_minutes`, `preparation_time_minutes`, `courier_id`, `courier_name`

## Comment je le génère

Script Python one-shot (`/tmp/build_refunds_xlsx.py`) qui :
1. Query Supabase via psql/postgrest sur les 5 `uber_order_id` filtrés par `restaurant_id = fe6d9c19-dd7a-4554-a29d-6b6f5a73a455` et `order_datetime` dans `[2026-01-14, 2026-01-18)`
2. Joint via `uber_order_id` + `uber_flow_id` sur les 4 autres tables
3. Écrit le `.xlsx` avec openpyxl, 1 onglet par table, en-têtes en gras, colonnes auto-width, montants formatés €

Pas de modif d'UI, pas de migration, c'est un export ponctuel pour ton diagnostic.
