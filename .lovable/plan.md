

# Fix: Timeout sur les requêtes de revenus (4.4M lignes + RLS)

## Problème
La RPC `get_daily_revenue_from_orders` timeout car :
1. La table `orders` contient **4.4 millions de lignes**
2. La RPC n'est **pas** `SECURITY DEFINER` → la politique RLS "Chain scoped access on orders" s'applique
3. Cette RLS fait un **sous-select sur `restaurants`** pour chaque ligne vérifiée, ce qui est extrêmement coûteux à cette échelle

Même résultat pour `get_monthly_revenue_from_orders`.

## Solution
Convertir les deux RPCs en `SECURITY DEFINER` (comme c'est déjà fait pour d'autres RPCs du projet : `get_network_orders_summary`, `get_network_ratings_summary`, etc.). Le filtrage par restaurant est déjà assuré par le paramètre `p_restaurant_ids`, donc la sécurité est maintenue.

## Migration SQL

```sql
ALTER FUNCTION public.get_daily_revenue_from_orders(date, date, uuid[]) 
  SECURITY DEFINER 
  SET search_path = public;

ALTER FUNCTION public.get_monthly_revenue_from_orders(date, date, uuid[]) 
  SECURITY DEFINER 
  SET search_path = public;
```

## Impact
- Les requêtes bypassent la RLS coûteuse et utilisent directement l'index `idx_orders_restaurant_datetime`
- Temps de réponse attendu : de timeout (>2min) à quelques secondes
- Aucun changement côté frontend

