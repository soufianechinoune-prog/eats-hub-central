

## Fix: Deliveroo Finances infinite loading / blank screen

### Root Cause

When Deliveroo is selected, the `deliverooPayoutsData` query paginates through thousands of rows (15-20 sequential requests). The `loadingDeliverooPayouts` state is extracted in `Analytics.tsx` but **never passed down** to `AnalyticsCharts` or `FinancesSection`.

In `FinancesSection`, the loading spinner depends only on `isChartLoading` (from its internal `useFinancesDrilldown` hook). Once that hook finishes loading, the spinner disappears — but `dailyPayoutsData` is still `[]` because the parent Deliveroo query hasn't completed. Result: no spinner, no chart, no table → blank screen.

### Fix (3 files)

**1. `src/pages/Analytics.tsx`**
- Pass `loadingDeliverooPayouts` to `AnalyticsCharts` via a new `isPayoutsLoading` prop:
  ```typescript
  isPayoutsLoading={loadingDeliverooPayouts}
  ```

**2. `src/components/analytics/AnalyticsCharts.tsx`**
- Accept `isPayoutsLoading?: boolean` in props
- Forward it to `FinancesSection` as a new prop

**3. `src/components/analytics/FinancesSection.tsx`**
- Accept `isPayoutsLoading?: boolean` in props
- Update the loading condition (line 150) to also show the spinner when the parent payouts data is still loading:
  ```typescript
  {(isPayoutsLoading || ((!chartDailyData || chartDailyData.length === 0) && (!dailyPayoutsData || dailyPayoutsData.length === 0) && isChartLoading)) && (
    <Loader2 spinner />
  )}
  ```

This ensures the "Chargement des données financières…" spinner stays visible until the Deliveroo pagination completes.

