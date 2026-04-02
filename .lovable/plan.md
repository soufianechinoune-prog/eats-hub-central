

## Objectif
Optimiser les 3 RPCs lentes de la Vue d'ensemble et dédupliquer les appels customer_reviews.

## Modifications

### 1. SQL — Ajouter `statement_timeout` sur 2 RPCs (migration)

**`get_availability_by_restaurant`** : Ajouter `SET statement_timeout TO '10s'` dans la déclaration de fonction.

**`get_product_sales_for_period`** : Ajouter `SET statement_timeout TO '10s'` + ajouter `LIMIT 100` (on n'affiche que le top produits, pas besoin de tous les renvoyer).

**`get_network_prep_time_summary`** : Réduire le timeout existant de `30s` à `10s`.

### 2. SQL — Optimiser `get_product_sales_for_period`

Actuellement la RPC fait un `JOIN orders + order_items` sans filtre de date de fin. Ajouter un paramètre `p_end_date` et un `LIMIT 50` pour ne renvoyer que le top 50 :

```sql
CREATE OR REPLACE FUNCTION public.get_product_sales_for_period(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(item_title text, total_quantity bigint)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  SELECT oi.item_title, SUM(oi.quantity)::BIGINT as total_quantity
  FROM public.order_items oi
  JOIN public.orders o ON oi.order_id = o.id
  WHERE (p_start_date IS NULL OR o.order_datetime >= p_start_date)
    AND (p_end_date IS NULL OR o.order_datetime <= p_end_date)
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY oi.item_title
  ORDER BY total_quantity DESC
  LIMIT 50;
END;
$$;
```

### 3. SQL — Ajouter timeout sur `get_availability_by_restaurant`

```sql
CREATE OR REPLACE FUNCTION public.get_availability_by_restaurant(...)
-- Même corps, ajouter SET statement_timeout TO '10s'
```

### 4. `src/hooks/useOverviewData.ts` — Passer `p_end_date` à la RPC

Ligne 237-243, ajouter `p_end_date: endDate.toISOString()` dans l'appel RPC `get_product_sales_for_period`.

### 5. `src/hooks/useOverviewData.ts` — Dédupliquer customer_reviews

Extraire la queryKey reviews pour qu'elle soit identique entre `useOverviewData` et `useNetworkStats`. Comme les deux hooks sélectionnent des colonnes différentes (`overall_rating, review_date, platform` vs `overall_rating` seul), la solution simple : dans `useNetworkStats`, réutiliser la même queryKey `["overview-reviews", ...]` pour que React Query serve le cache au lieu de refaire la requête.

### Résumé des fichiers modifiés
- 1 migration SQL (3 RPCs modifiées)
- `src/hooks/useOverviewData.ts` (ajout `p_end_date`)
- `src/hooks/useNetworkStats.ts` (réutiliser queryKey reviews)

### Impact estimé
- `get_product_sales_for_period` : 8s → ~1-2s (LIMIT 50 + filtre date fin)
- `get_availability_by_restaurant` : protégé par timeout 10s
- customer_reviews : 1 appel au lieu de 2

