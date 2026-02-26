

# Fix data mismatch: replace truncated RPC with existing aggregation

## Analysis

`useOverviewData` calls `get_daily_revenue_from_orders` which returns **per-restaurant per-day** rows. For 92 restaurants × 31 days = ~2,852 rows, this exceeds the default 1,000-row limit and truncates data.

Looking at how `dailySalesData` is actually used in `computedData()`:
- `totalRevenue` = sum of all `revenue_ttc` (line 426)
- `totalOrders` = sum of all `order_count` (line 427)
- Per-restaurant: filter by `restaurant_id`, then sum `revenue_ttc` and `order_count` (lines 484-490)
- Platform filter: `dailySalesData.filter(d => d.platform === "uber_eats")` (line 549)

**None of this requires daily granularity.** It's all per-restaurant sums. The existing `get_network_orders_summary` RPC already returns exactly this data, aggregated per restaurant with no row limit issue.

Using `.range(0, 5000)` would be a fragile workaround — it could still break with more restaurants or longer periods. The clean fix is to reuse the same RPC already created.

## Plan

### 1. Remove redundant `salesData` query in `useNetworkStats.ts`
- Remove the `get_daily_revenue_from_orders` call (Wave 1)
- Derive Uber revenue/orders from `ordersPayoutData` (`get_network_orders_summary`) which returns `total_sales_incl_vat` and `order_count` per restaurant
- Remove `salesLoading` from `isLoading`, remove `salesData` from `useMemo` deps
- Adjust wave gating: Wave 2 (reviews/accuracy) starts after restaurants load, not after salesData

### 2. Replace `useOverviewSales` in `useOverviewData.ts`
- Replace `get_daily_revenue_from_orders` call with `get_network_orders_summary` RPC
- Returns ~92 rows (one per restaurant) instead of ~2,852
- Update `computedData()` to work with per-restaurant summary rows instead of daily rows
- The `platform` filter (line 549) becomes unnecessary since `get_network_orders_summary` only covers Uber orders — Deliveroo is already handled separately via `get_network_deliveroo_summary`

### Files modified
- `src/hooks/useNetworkStats.ts` — remove `salesData` query, derive from `ordersPayoutData`
- `src/hooks/useOverviewData.ts` — replace `useOverviewSales` with `get_network_orders_summary` RPC, update `computedData()`

No new migration needed — all required RPCs already exist.

