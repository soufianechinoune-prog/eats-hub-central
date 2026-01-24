

# Corriger le timeout : Créer une fonction RPC pour l'analyse Produits × Créneaux

## Problème identifié

La requête sur la table `orders` (162,861 lignes) cause un **timeout** car :
1. La table est volumineuse et la requête REST avec pagination prend trop de temps
2. Le hook actuel fait une requête client-side qui dépasse la limite de 8 secondes

**Erreur dans les logs réseau** :
```json
{"code":"57014","message":"canceling statement due to statement timeout"}
```

## Solution proposée

Créer une **fonction RPC PostgreSQL** `get_products_by_time_slot` qui effectue l'agrégation côté serveur, comme déjà fait pour `get_hourly_order_performance`.

### 1. Créer la fonction RPC (migration SQL)

La fonction agrégera directement les données en SQL :

```sql
CREATE OR REPLACE FUNCTION get_products_by_time_slot(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_top_n integer DEFAULT 3
)
RETURNS TABLE (
  slot_label text,
  slot_range text,
  product_title text,
  quantity bigint,
  revenue numeric,
  percent_of_slot numeric,
  rank integer,
  slot_total_orders bigint,
  slot_total_revenue numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH order_slots AS (
    SELECT 
      o.id as order_id,
      EXTRACT(HOUR FROM o.order_datetime) as hour,
      CASE 
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 11 AND 14 THEN 'Déjeuner'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 15 AND 17 THEN 'Après-midi'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 18 AND 21 THEN 'Dîner'
        WHEN EXTRACT(HOUR FROM o.order_datetime) IN (22, 23) THEN 'Soirée'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 0 AND 3 THEN 'Late-night'
        ELSE NULL
      END as slot_label,
      CASE 
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 11 AND 14 THEN '11h-15h'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 15 AND 17 THEN '15h-18h'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 18 AND 21 THEN '18h-22h'
        WHEN EXTRACT(HOUR FROM o.order_datetime) IN (22, 23) THEN '22h-00h'
        WHEN EXTRACT(HOUR FROM o.order_datetime) BETWEEN 0 AND 3 THEN '00h-04h'
        ELSE NULL
      END as slot_range
    FROM orders o
    WHERE o.restaurant_id = ANY(p_restaurant_ids)
      AND o.order_datetime::date BETWEEN p_start_date AND p_end_date
      AND o.order_datetime IS NOT NULL
  ),
  product_agg AS (
    SELECT 
      os.slot_label,
      os.slot_range,
      oi.item_title as product_title,
      SUM(oi.quantity) as quantity,
      SUM(oi.sales_incl_vat) as revenue
    FROM order_slots os
    JOIN order_items oi ON oi.order_id = os.order_id
    WHERE os.slot_label IS NOT NULL
    GROUP BY os.slot_label, os.slot_range, oi.item_title
  ),
  slot_totals AS (
    SELECT 
      slot_label,
      SUM(quantity) as total_qty,
      SUM(revenue) as total_revenue,
      COUNT(DISTINCT order_id) as total_orders
    FROM order_slots os
    JOIN order_items oi ON oi.order_id = os.order_id
    WHERE slot_label IS NOT NULL
    GROUP BY slot_label
  ),
  ranked AS (
    SELECT 
      pa.*,
      st.total_orders,
      st.total_revenue as slot_total,
      ROUND(pa.revenue * 100.0 / NULLIF(st.total_revenue, 0), 0) as pct,
      ROW_NUMBER() OVER (PARTITION BY pa.slot_label ORDER BY pa.revenue DESC) as rn
    FROM product_agg pa
    JOIN slot_totals st ON st.slot_label = pa.slot_label
  )
  SELECT 
    r.slot_label,
    r.slot_range,
    r.product_title,
    r.quantity,
    r.revenue,
    r.pct as percent_of_slot,
    r.rn::integer as rank,
    r.total_orders as slot_total_orders,
    r.slot_total as slot_total_revenue
  FROM ranked r
  WHERE r.rn <= p_top_n
  ORDER BY 
    CASE r.slot_label 
      WHEN 'Déjeuner' THEN 1
      WHEN 'Après-midi' THEN 2
      WHEN 'Dîner' THEN 3
      WHEN 'Soirée' THEN 4
      WHEN 'Late-night' THEN 5
    END,
    r.rn;
END;
$$;
```

### 2. Modifier le hook `useProductsByTimeSlot`

Remplacer les requêtes REST paginées par un appel RPC unique :

```typescript
const { data, isLoading } = useQuery({
  queryKey: ["products-by-slot-rpc", restaurantIds, startDate, endDate, topN],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_products_by_time_slot", {
      p_restaurant_ids: restaurantIds,
      p_start_date: startDate,
      p_end_date: endDate,
      p_top_n: topN,
    });
    if (error) throw error;
    return data || [];
  },
  enabled: !!restaurantIds?.length,
});
```

### 3. Adapter la transformation des données

Transformer le résultat plat de la RPC en structure `ProductSlotData[]` attendue par le composant.

---

## Avantages de cette approche

| Aspect | Avant (REST) | Après (RPC) |
|--------|--------------|-------------|
| Temps d'exécution | Timeout (>8s) | ~100-500ms |
| Nombre de requêtes | 2+ (orders + items en chunks) | 1 seule |
| Transfert réseau | ~160k lignes orders + items | ~15 lignes (top 3 × 5 slots) |
| Pagination | Nécessaire | Non |

---

## Résumé des fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| Migration SQL | Nouvelle fonction RPC `get_products_by_time_slot` |
| `src/hooks/useProductsByTimeSlot.ts` | Remplacer les requêtes REST par un appel RPC |

---

## Section technique

### Structure du résultat RPC

```typescript
interface RpcResult {
  slot_label: string;
  slot_range: string;
  product_title: string;
  quantity: number;
  revenue: number;
  percent_of_slot: number;
  rank: number;
  slot_total_orders: number;
  slot_total_revenue: number;
}
```

### Transformation en ProductSlotData

```typescript
// Grouper par slot
const slotMap = new Map<string, ProductSlotData>();

data.forEach((row) => {
  if (!slotMap.has(row.slot_label)) {
    slotMap.set(row.slot_label, {
      slotLabel: row.slot_label,
      slotRange: row.slot_range,
      slotHours: TIME_SLOTS.find(s => s.label === row.slot_label)?.hours || [],
      topProducts: [],
      totalOrders: row.slot_total_orders,
      totalRevenue: row.slot_total_revenue,
    });
  }
  
  slotMap.get(row.slot_label)!.topProducts.push({
    title: row.product_title,
    quantity: row.quantity,
    revenue: row.revenue,
    percentOfSlot: row.percent_of_slot,
    rank: row.rank,
  });
});

return Array.from(slotMap.values());
```

