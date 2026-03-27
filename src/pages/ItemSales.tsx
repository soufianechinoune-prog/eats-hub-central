import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  const { selectedChainId } = useAnalyticsContext();

  // Get chain restaurants for scope isolation
  const { data: chainRestaurantsData } = useQuery({
    queryKey: ["chain-restaurants-for-items", selectedChainId],
    queryFn: async () => {
      if (!selectedChainId) return null;
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("chain_id", selectedChainId);
      return data?.map(r => r.id) || [];
    },
  });

  const restaurantFilter = useMemo(() => {
    if (selectedRestaurants.length > 0) return selectedRestaurants;
    if (selectedChainId && chainRestaurantsData !== undefined) {
      return chainRestaurantsData; // may be [] → triggers empty result in hook
    }
    return undefined;
  }, [selectedRestaurants, selectedChainId, chainRestaurantsData]);

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
