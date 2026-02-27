

# Fix: Deliveroo order count always showing 1 (daily) or 31 (monthly) in profitability chart

## Root cause

In `src/hooks/useFinancesDrilldown.ts`, the `fetchDeliverooOrdersData` function (lines 67-149) groups all Deliveroo rows by `date|restaurant_id` into a single aggregated object per day. This aggregated object does **not** track the number of individual orders (Livraison rows).

Later, `dailyData` (line 617) increments `count += 1` for each element in the array. Since each Deliveroo day is collapsed into 1 element, the count is always 1 per day, hence 31 for a full month.

For Uber, each raw row is an individual order so this works correctly. For Deliveroo and Global mode, the count is wrong.

## Fix

### `src/hooks/useFinancesDrilldown.ts`

1. **Add `order_count` field** to the grouped object in `fetchDeliverooOrdersData` (line 103-112), initialized to 0
2. **Increment `order_count`** inside the `DELIVEROO_ORDER_TYPES` branch (line 131) — each "Livraison"/"À emporter"/"Nouvelle livraison" row represents one real order
3. **In `dailyData` computation** (line 617), change `byDate[date].count += 1` to use `order.order_count || 1` — this way Deliveroo records contribute their aggregated count while Uber records (which have no `order_count` field) default to 1
4. **Same fix in `dailyDataByRestaurant`** (line 673)

This ensures the tooltip shows the real number of Deliveroo orders per day/month instead of the number of aggregated records.

