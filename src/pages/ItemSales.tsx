import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ItemSalesAnalytics } from "@/components/analytics/ItemSalesAnalytics";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";

export default function ItemSales() {
  const {
    selectedRestaurants,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
  } = useAnalyticsContext();

  // Calculate date range based on period mode
  const { startDate, endDate } = useMemo(() => {
    if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      return { startDate: dateRange.from, endDate: dateRange.to };
    }
    
    if (periodMode === "month") {
      const monthStart = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth - 1));
      return { startDate: monthStart, endDate: monthEnd };
    }
    
    // Default to full year
    return {
      startDate: startOfYear(new Date(selectedYear, 0)),
      endDate: endOfYear(new Date(selectedYear, 0)),
    };
  }, [periodMode, selectedYear, selectedMonth, dateRange]);

  const restaurantFilter = selectedRestaurants.length > 0 ? selectedRestaurants : undefined;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold">Analyse des ventes par article</h1>
            <p className="text-muted-foreground">
              Performance détaillée des produits, top/flop et remboursements
            </p>
          </div>
          <AnalyticsHeader />
        </div>

        <ItemSalesAnalytics
          restaurantIds={restaurantFilter}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
    </AppLayout>
  );
}
