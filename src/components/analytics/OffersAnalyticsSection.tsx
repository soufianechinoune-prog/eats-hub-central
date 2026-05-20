import { useMemo } from "react";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useOffersAnalytics } from "@/hooks/useOffersAnalytics";
import { useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { resolveBrandScopedRestaurantIds } from "@/lib/brandScope";
import { OffersSummaryTab } from "./offers/OffersSummaryTab";
import { OfferFeesHistoryTab } from "./offers/OfferFeesHistoryTab";
import { OfferFeesCorrelationTab } from "./offers/OfferFeesCorrelationTab";

export function OffersAnalyticsSection() {
  const {
    selectedRestaurants,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
    selectedChainId,
  } = useAnalyticsContext();

  const { data: activeRestaurants = [] } = useActiveRestaurants();

  const restaurants = useMemo(
    () => activeRestaurants.map((r) => ({ id: r.id, name: r.name })),
    [activeRestaurants],
  );

  const chainRestaurantIds = useMemo(
    () => activeRestaurants.map((r) => r.id),
    [activeRestaurants],
  );

  const { startDate, endDate } = useMemo(() => {
    if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      return { startDate: format(dateRange.from, "yyyy-MM-dd"), endDate: format(dateRange.to, "yyyy-MM-dd") };
    }
    if (periodMode === "month" && selectedMonth > 0) {
      const s = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      const e = endOfMonth(s);
      return { startDate: format(s, "yyyy-MM-dd"), endDate: format(e, "yyyy-MM-dd") };
    }
    const s = startOfYear(new Date(selectedYear, 0));
    const e = new Date() < endOfYear(s) ? new Date() : endOfYear(s);
    return { startDate: format(s, "yyyy-MM-dd"), endDate: format(e, "yyyy-MM-dd") };
  }, [selectedYear, selectedMonth, periodMode, dateRange]);

  const restaurantIds = useMemo(() => (
    resolveBrandScopedRestaurantIds({
      selectedRestaurantIds: selectedRestaurants,
      selectedChainId,
      chainRestaurantIds,
    }) ?? []
  ), [selectedRestaurants, selectedChainId, chainRestaurantIds]);

  const offersData = useOffersAnalytics(restaurantIds, startDate, endDate, restaurants);

  if (offersData.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (offersData.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Erreur lors du chargement des données d'offres.
        </p>
        {offersData.errorMessage && (
          <p className="text-xs text-muted-foreground/70 max-w-md font-mono">{offersData.errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <Tabs defaultValue="history" className="space-y-4">
      <TabsList className="grid w-full max-w-2xl grid-cols-3">
        <TabsTrigger value="history">Historique frais 0,89€</TabsTrigger>
        <TabsTrigger value="correlation">Croisements</TabsTrigger>
        <TabsTrigger value="summary">Synthèse</TabsTrigger>
      </TabsList>

      <TabsContent value="history" className="mt-6">
        <OfferFeesHistoryTab data={offersData} restaurants={restaurants} />
      </TabsContent>

      <TabsContent value="correlation" className="mt-6">
        <OfferFeesCorrelationTab
          data={offersData}
          restaurantIds={restaurantIds}
          startDate={startDate}
          endDate={endDate}
        />
      </TabsContent>

      <TabsContent value="summary" className="mt-6">
        <OffersSummaryTab data={offersData} restaurants={restaurants} />
      </TabsContent>
    </Tabs>
  );
}
