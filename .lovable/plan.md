

## Fix: Tableau "Comparatif de Rentabilité" absent pour Deliveroo

### Diagnostic

Le tableau de rentabilité par restaurant n'apparaît pas quand Deliveroo est sélectionné car la query `deliverooPayoutsData` pagine **toutes les lignes brutes** de `deliveroo_orders` sur 3 ans (potentiellement 30 000+ lignes) avec des requêtes de 1000 lignes séquentielles. C'est trop lent — le chargement ne termine pas ou prend des minutes.

Le graphique et l'"Analyse par Commandes" fonctionnent car ils utilisent leurs propres hooks optimisés (`useFinancesDrilldown`) qui agrègent côté serveur.

### Solution : Créer un RPC serveur pour agréger les données Deliveroo

Au lieu de tout charger côté client, créer une fonction SQL `get_deliveroo_payouts_detail` qui agrège directement en base par semaine + restaurant (même logique que le code JavaScript actuel, mais exécutée en SQL en quelques millisecondes).

### Étapes

**1. Migration SQL** — Créer la fonction `get_deliveroo_payouts_detail`
- Paramètres : `p_start_date`, `p_end_date`, `p_restaurant_ids`
- Agrège `deliveroo_orders` par semaine (lundi) + `restaurant_id`
- Retourne les mêmes colonnes que le format attendu : `payout_date`, `restaurant_id`, `sales_incl_vat`, `uber_fee_after_promo_incl_vat`, `item_promo_incl_vat`, `refund_incl_vat`, `net_payout`, `order_count`, `other_payments_incl_vat`, `marketing_fee_adjustment`, `meal_voucher_amount`
- Filtre les `history_type` correctement (Livraison, À emporter = ventes ; Remboursement client = refunds ; Contribution marketing = promos, etc.)

**2. `src/pages/Analytics.tsx`** — Remplacer la pagination client par l'appel RPC
- Remplacer la query `deliverooPayoutsData` (~lignes 342-513) : au lieu de paginer `deliveroo_orders` et grouper en JS, appeler `supabase.rpc('get_deliveroo_payouts_detail', { p_start_date, p_end_date, p_restaurant_ids })`
- 1 seule requête au lieu de 15-20 requêtes paginées
- Temps de chargement : de ~30-60 secondes → <2 secondes

### Impact
- Le tableau "Comparatif de Rentabilité" apparaîtra instantanément pour Deliveroo
- Même format de données que pour Uber → compatibilité garantie avec le tableau existant
- Le graphique et l'analyse par commandes continueront de fonctionner comme avant

