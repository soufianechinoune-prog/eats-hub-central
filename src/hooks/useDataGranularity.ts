import { useMemo } from "react";
import { differenceInDays, startOfMonth, endOfMonth } from "date-fns";

export type DataGranularity = "daily" | "weekly" | "monthly";

interface UseDataGranularityParams {
  periodMode: "year" | "month" | "range" | "custom";
  selectedYear: number;
  selectedMonth?: number;
  dateRange?: { from?: Date; to?: Date };
}

/**
 * Hook to determine optimal data granularity based on selected time period
 * - Daily: for periods ≤ 1 month or custom ranges ≤ 31 days
 * - Weekly: for periods 1-3 months
 * - Monthly: for periods > 3 months or full year views
 */
export function useDataGranularity({
  periodMode,
  selectedYear,
  selectedMonth,
  dateRange,
}: UseDataGranularityParams): {
  granularity: DataGranularity;
  startDate: Date;
  endDate: Date;
  periodDays: number;
} {
  return useMemo(() => {
    let startDate: Date;
    let endDate: Date;
    let periodDays: number;

    if ((periodMode === "custom" || periodMode === "range") && dateRange?.from && dateRange?.to) {
      // Custom date range
      startDate = dateRange.from;
      endDate = dateRange.to;
      periodDays = differenceInDays(endDate, startDate) + 1;
    } else if (periodMode === "month" && selectedMonth) {
      // Single month view
      startDate = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      endDate = endOfMonth(startDate);
      periodDays = differenceInDays(endDate, startDate) + 1;
    } else {
      // Full year view
      startDate = new Date(selectedYear, 0, 1);
      endDate = new Date(selectedYear, 11, 31);
      periodDays = differenceInDays(endDate, startDate) + 1;
    }

    // Determine granularity based on period length
    let granularity: DataGranularity;
    
    if (periodDays <= 31) {
      // ≤ 1 month: use daily data
      granularity = "daily";
    } else if (periodDays <= 93) {
      // 1-3 months: use weekly aggregation
      granularity = "weekly";
    } else {
      // > 3 months: use monthly data
      granularity = "monthly";
    }

    return {
      granularity,
      startDate,
      endDate,
      periodDays,
    };
  }, [periodMode, selectedYear, selectedMonth, dateRange]);
}
