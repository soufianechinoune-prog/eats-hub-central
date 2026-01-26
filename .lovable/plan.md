

# Correction des données de ventes dans le simulateur BOGO

## Problème identifié

Les chiffres de ventes sont **faux** car l'API REST Supabase limite à **1 000 lignes** par requête.

| Réalité | Affiché |
|---------|---------|
| 7 838 commandes sur 30 jours | ~1 000 commandes récupérées |
| Naan "TENDERS" : 3 921 ventes | ~271 ventes affichées |

La requête actuelle (lignes 189-198 de `BogoSimulator.tsx`) fait une jointure via l'API REST qui tronque les résultats.

---

## Solution

Créer une **fonction PostgreSQL RPC** qui agrège les ventes côté serveur, sans limite de lignes.

---

## Modifications à apporter

### 1. Créer une nouvelle fonction RPC PostgreSQL

Nouvelle migration SQL :

```sql
CREATE OR REPLACE FUNCTION get_product_sales_for_period(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_restaurant_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  item_title TEXT,
  total_quantity BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.item_title,
    SUM(oi.quantity)::BIGINT as total_quantity
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE 
    (p_start_date IS NULL OR o.order_datetime >= p_start_date)
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY oi.item_title
  ORDER BY total_quantity DESC;
END;
$$;
```

### 2. Modifier `BogoSimulator.tsx`

Remplacer la requête REST (lignes 186-212) par un appel RPC :

```tsx
// Avant (LIMITÉ à 1000 lignes)
const { data, error } = await supabase
  .from("orders")
  .select(`order_datetime, order_items (item_title, quantity)`)
  .gte("order_datetime", startDate);

// Après (SANS LIMITE)
const { data, error } = await supabase
  .rpc("get_product_sales_for_period", {
    p_start_date: startDate,
    p_restaurant_ids: restaurantIds.length > 0 ? restaurantIds : null
  });
```

La logique de matching fuzzy restera côté client, mais avec les **données complètes**.

---

## Résultat attendu

| Produit | Avant (tronqué) | Après (complet) |
|---------|-----------------|-----------------|
| Naan "TENDERS" | 271 | ~3 921 |
| Menu Naan TENDERS | ~100 | ~283 |
| Tous produits | ~500 matchés | ~7 800+ lignes |

---

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| Migration SQL | Créer RPC `get_product_sales_for_period` |
| `src/components/menu/offers/BogoSimulator.tsx` | Utiliser la RPC au lieu de la jointure REST |

