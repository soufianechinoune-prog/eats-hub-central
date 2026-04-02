

## Analyse de la proposition

### Index 1 : `idx_orders_restaurant_datetime_rpc`
**Inutile** — cet index existe déjà : `idx_orders_restaurant_datetime ON public.orders(restaurant_id, order_datetime)` (migration du 14 mars). Ajouter un doublon avec `WHERE order_datetime IS NOT NULL` n'apporte quasi rien car `order_datetime` est rarement NULL. PostgreSQL utilise déjà cet index.

### Index 2 : `idx_order_items_order_covering`
**Pertinent** — un index couvrant sur `order_items(order_id, item_title, quantity)` permet un Index-Only Scan sur le JOIN, évitant les accès au heap pour chaque ligne. C'est le vrai gain ici.

### Mon avis
L'ingénieure a raison sur le fond (le JOIN est le goulot), mais le premier index est un doublon. Je propose de créer uniquement le covering index sur `order_items`.

## Migration SQL

```sql
CREATE INDEX IF NOT EXISTS idx_order_items_order_covering
ON public.order_items(order_id, item_title, quantity);
```

## Impact estimé
- Le JOIN `order_items → orders` passera de Seq Scan à Index-Only Scan
- `get_product_sales_for_period` : 3.7s → **< 1s**

## Aucun changement frontend

