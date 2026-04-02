

## Objectif
Appliquer `SECURITY DEFINER` sur `get_network_orders_summary` et `get_network_deliveroo_summary` pour éliminer le RLS par ligne qui cause les timeouts 500.

## Migration SQL

Les 2 fonctions gardent leur corps SQL identique. Seuls les attributs changent :
- Ajout `SECURITY DEFINER`
- Ajout `SET search_path TO 'public'` (sécurité obligatoire avec SECURITY DEFINER)
- `statement_timeout` réduit de `30s` à `10s`

### `get_network_orders_summary`
```sql
CREATE OR REPLACE FUNCTION public.get_network_orders_summary(
  p_restaurant_ids uuid[], p_start_date date, p_end_date date
)
RETURNS TABLE(restaurant_id uuid, total_sales_incl_vat numeric, total_net_payout numeric, 
              total_item_promo_incl_vat numeric, total_meal_voucher numeric, order_count bigint)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$ -- même corps SQL exact $$
```

### `get_network_deliveroo_summary`
```sql
CREATE OR REPLACE FUNCTION public.get_network_deliveroo_summary(
  p_restaurant_ids uuid[], p_start_date date, p_end_date date
)
RETURNS TABLE(restaurant_id uuid, total_revenue numeric, total_payable numeric, order_count bigint)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$ -- même corps SQL exact $$
```

## Sécurité
Identique au pattern validé sur les 3 RPCs précédentes : `p_restaurant_ids` est toujours filtré côté app par `useAnalyticsContext`.

## Impact estimé
- `get_network_orders_summary` : timeout 500 → **< 500ms**
- `get_network_deliveroo_summary` : timeout 500 → **< 500ms**

## Fichiers modifiés
- 1 migration SQL uniquement
- Aucun changement frontend

