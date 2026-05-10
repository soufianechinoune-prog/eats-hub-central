## Réponse à ta question

**Oui, le matching est possible.** Toutes les tables alimentées par CSV partagent la même clé `uber_order_id`, qui est aussi rempli sur 100% des commandes API (vérifié : 107 230/107 230 commandes API mars 2026).

| Donnée | Table | Clé de matching | Granularité |
|---|---|---|---|
| Éco-contribution (CSV PAYMENT_DETAILS) | `orders.eco_contribution_refund` | `uber_order_id` ✅ | par commande |
| Coût pub Ads (CSV PAYMENTS) | `payouts.ads_cost` (n'existe pas en colonne séparée — agrégé) | `payout_date` ❌ | hebdo, pas par commande |
| Erreurs détaillées (CSV) | `order_errors` | `uber_order_id` ✅ | par commande |
| Stats livraison (CSV ORDER_HISTORY) | `delivery_stats` + `order_history` | `uber_order_id` ✅ | par commande |
| Conversion (CSV) | `daily_conversion` | `restaurant_id` + `date` ✅ | par jour |

**Conclusion** : on peut tout réconcilier proprement, sauf le coût Ads qui restera un total hebdo/mensuel (Uber ne le fournit que dans le relevé de versement).

---

## Stratégie : "API d'abord, CSV en complément"

### 1. Source de vérité = API pour tout ce qui est commande
- **CA, commissions, promos, refunds, marketing fees, offer usage, net payout, meal vouchers, TVA** → 100% API via la table `orders` filtrée par `order_datetime`.
- **Cohérence garantie** entre Overview et Finances & Frais (même requête, même filtre).

### 2. CSV en complément pour les champs que l'API ne fournit pas
On continue à importer les CSV existants. À l'import, on **enrichit** les commandes API existantes (UPDATE par `uber_order_id`) au lieu de créer des doublons :

| CSV à importer | Champ enrichi | Où ça remonte |
|---|---|---|
| **PAYMENT_DETAILS_REPORT** | `orders.eco_contribution_refund`, `tip_amount`, `vat_adjustment`, `price_adjustment`, `other_payments_incl_vat` | Finances & Frais (lignes Éco / Pourboires / Ajustements) |
| **PAYMENTS** (relevé de versement) | `payouts.ads_cost`, `marketing_fee_adjustment` consolidés | Finances & Frais (encart "Frais hebdomadaires Uber") |
| **ORDER_ERRORS_*** | `order_errors` (lié par `uber_order_id`) | Operations / Order Accuracy |
| **ORDER_HISTORY_REPORT** | `delivery_stats` + `order_history` (lié par `uber_order_id`) | Opérations (temps prep / livraison) |
| **CONVERSION** | `daily_conversion` | Conversion tab |
| **DOWNTIME** | `hourly_availability` | Downtime tab |
| **REVIEWS** | `customer_reviews`, `menu_item_reviews` | Reviews tab |

### 3. Modifications nécessaires sur Finances & Frais (UI)

**a)** Nouvelle RPC `get_orders_finance_summary(restaurant_ids, start, end, granularity)` :
- Source : `orders` filtré par `order_datetime` (cohérent avec Overview).
- Retour : CA TTC/HT, TVA, promos, commissions, marketing, offer usage, refunds, meal vouchers, **éco-contribution**, **pourboires**, net payout calculé.
- `SECURITY DEFINER`, scope `chain_id`, sentinel `'0000...'`.

**b)** `ProfitabilityComparisonTable.tsx` consomme cette RPC au lieu de `get_monthly_payouts_*` / `get_yearly_payouts_detail` (mode Uber Eats uniquement). Forme `PayoutData[]` inchangée.

**c)** Ajout d'un **encart séparé en bas du tableau** : "Frais hebdomadaires Uber (relevés)" avec **Coût pub Ads** + ajustements consolidés du payout — récupérés depuis `payouts` filtré par chevauchement de période. Visuellement distinct pour signaler "donnée hebdo, pas par commande".

**d)** `DataSourceBadge` étendu pour afficher : "Données commandes : API • Frais hebdo : Relevés Uber".

**e)** Deliveroo : aucun changement (déjà aligné par commande).

### 4. Hors scope
- Pas de changement sur Overview.
- Pas de suppression de la table `payouts` (reste utilisée pour Ads + réconciliation).
- Pas de changement sur les pages Operations / Conversion / Reviews (déjà CSV-only et OK).

---

## Détails techniques

**Risques** : faibles. Lecture seule via RPC `SECURITY DEFINER`. La table `orders` contient déjà tous les champs nécessaires (vérifié colonnes `uber_fee_*`, `vat_uber_fee`, `item_promo_*`, `marketing_fee_adjustment`, `eco_contribution_refund`, `meal_voucher_amount`, `offer_usage_fee`, `refund_*`).

**Validation** :
- Reims (uber_api) mars 2026 : CA Finances & Frais doit = CA Overview à l'euro près.
- Un restaurant CSV-only (ex: Lyon) : aucun changement visible (orders y est rempli par CSV, même résultat).

**Évolution import PAYMENT_DETAILS** : déjà UPSERT par `uber_order_id` dans `parse-payment-report` → enrichira automatiquement les lignes API existantes. Aucun changement d'import nécessaire.

**Ads cost** : à terme, on pourrait extraire `ads_cost` du CSV PAYMENTS dans une colonne dédiée de `payouts` (actuellement noyé dans `marketing_fee_adjustment` / `other_payments_incl_vat`). Étape optionnelle.
