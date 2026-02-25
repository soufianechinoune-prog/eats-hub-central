

# Skip daily chart when a single day is selected

## Problem

When a single day is selected (via custom range or period selector), two issues occur:
1. **UI**: The daily chart shows one massive bar taking the full width, which is useless. The user then has to click it again to see the hourly breakdown.
2. **PDF**: The "Disponibilite journaliere" section renders one enormous bar for that single day, wasting space.

The fix is to detect single-day periods and bypass the daily view entirely.

## Changes

### 1. `src/components/analytics/OperationsAnalytics.tsx`

**Auto-detect single-day period and set `selectedDay` automatically.**

After `dateRange` is computed (~line 106), add an `useEffect` that checks if `startDate` and `endDate` are the same calendar day. If so, automatically set `selectedDay` to that date string. This skips the daily bar chart and jumps directly to the hourly drill-down view.

When the period changes back to a multi-day range, `selectedDay` is cleared.

```typescript
// Auto-drill into hourly view when period is a single day
useEffect(() => {
  const start = format(dateRange.start, "yyyy-MM-dd");
  const end = format(dateRange.end, "yyyy-MM-dd");
  if (start === end && useDailyView) {
    setSelectedDay(start);
  } else if (selectedDay && start !== end) {
    setSelectedDay(null);
  }
}, [dateRange.start, dateRange.end, useDailyView]);
```

### 2. `src/hooks/useReportPdfExport.ts`

**Skip the daily bar chart in PDF when there is only 1 day.**

Around line 358 ("DAILY BAR CHART"), wrap the daily bar chart rendering in a condition: only draw it if `sortedDays.length > 1`. When it is a single day, skip directly to the hourly detail section which already handles the breakdown.

Also adjust the hourly section (line 396): remove the `sortedDays.length <= 14` guard for single-day exports so the hourly chart always renders, and show the hourly chart for all hours (not just days with issues) when it is a single day.

### Files modified
- `src/components/analytics/OperationsAnalytics.tsx` (add useEffect for single-day auto-drill)
- `src/hooks/useReportPdfExport.ts` (skip daily chart when 1 day, always show hourly detail)

