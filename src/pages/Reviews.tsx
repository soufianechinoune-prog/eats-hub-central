import { useMemo, useState } from "react";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewsOverview } from "@/components/reviews/ReviewsOverview";
import { ReviewsCustomerList } from "@/components/reviews/ReviewsCustomerList";
import { ReviewsMenuItems } from "@/components/reviews/ReviewsMenuItems";

import { WeatherCorrelation } from "@/components/reviews/WeatherCorrelation";
import { useCustomerReviews, useMenuItemReviews, useReviewsOverviewStats, DateMode } from "@/hooks/useReviews";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Eye, Users, ChefHat, Cloud, CalendarDays, MessageSquare, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useReviewsExportData } from "@/hooks/useReviewsExportData";

export default function Reviews() {
  const [dateMode, setDateMode] = useState<DateMode>("order");
  const [activeTab, setActiveTab] = useState("overview");
  
  const {
    selectedRestaurants,
    selectedPlatform,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
    selectedChainId,
  } = useAnalyticsContext();

  // Calculer les dates de filtrage selon le mode de période
  const { startDate, endDate } = useMemo(() => {
    const usesContextRange =
      (periodMode === "range" ||
        periodMode === "previous_week" ||
        periodMode === "7d" ||
        periodMode === "30d" ||
        periodMode === "current_month") &&
      dateRange?.from &&
      dateRange?.to;

    if (usesContextRange) {
      return { startDate: dateRange!.from!, endDate: dateRange!.to! };
    } else if (periodMode === "month") {
      const monthDate = new Date(selectedYear, selectedMonth - 1, 1);
      return {
        startDate: startOfMonth(monthDate),
        endDate: endOfMonth(monthDate),
      };
    } else {
      // periodMode === "year" or default
      const yearDate = new Date(selectedYear, 0, 1);
      return {
        startDate: startOfYear(yearDate),
        endDate: endOfYear(yearDate),
      };
    }
  }, [periodMode, dateRange, selectedYear, selectedMonth]);

  // Date étendue pour le calcul de la moyenne glissante 90 jours
  const extendedStartDate = useMemo(() => {
    const extended = new Date(startDate);
    extended.setDate(extended.getDate() - 89);
    return extended;
  }, [startDate]);

  // Fetch restaurants data (filtered by active chain)
  const { data: restaurantsData } = useQuery({
    queryKey: ["restaurants-for-reviews", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, city")
        .order("name");
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // When a chain is selected but no specific restaurants, use all chain restaurants as filter
  const restaurantIds = useMemo(() => {
    if (selectedRestaurants.length > 0) return selectedRestaurants;
    if (selectedChainId && restaurantsData) {
      return restaurantsData.map(r => r.id);
    }
    return undefined;
  }, [selectedRestaurants, selectedChainId, restaurantsData]);

  // Filter restaurants based on selection
  const filteredRestaurants = useMemo(() => {
    if (!restaurantsData) return [];
    if (!restaurantIds || restaurantIds.length === 0) return restaurantsData;
    return restaurantsData.filter((r) => restaurantIds.includes(r.id));
  }, [restaurantsData, restaurantIds]);

  // === CONDITIONAL LOADING: only load data for the active tab ===

  // Overview tab: use RPC for instant KPIs (no individual rows needed for KPIs)
  const {
    data: overviewStats,
    isLoading: isLoadingOverviewStats,
  } = useReviewsOverviewStats(restaurantIds, selectedPlatform, startDate, endDate, dateMode, activeTab === "overview");

  // Overview tab also needs individual reviews for evolution chart + rolling average
  // Use a SINGLE call on extended period, filter in memory for normal period
  const needsReviews = activeTab === "customers" || activeTab === "weather";
  const {
    data: extendedReviews,
    isLoading: isLoadingExtended,
  } = useCustomerReviews(
    restaurantIds,
    selectedPlatform,
    activeTab === "overview" || activeTab === "weather" ? extendedStartDate : startDate,
    endDate,
    dateMode,
    needsReviews
  );

  // Filter extended reviews to get normal period reviews (in memory)
  const customerReviews = useMemo(() => {
    if (!extendedReviews) return [];
    return extendedReviews.filter(r => {
      const dateStr = dateMode === "order" && r.order_date ? r.order_date : r.review_date;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= startDate && d <= endDate;
    });
  }, [extendedReviews, startDate, endDate, dateMode]);

  // Menu items: only load when "Plats" tab is active
  const {
    data: menuItemReviews,
    isLoading: isLoadingMenuItems,
  } = useMenuItemReviews(restaurantIds, selectedPlatform, startDate, endDate, activeTab === "menu");

  const { exportReviews, isExporting: isExportingData } = useReviewsExportData();

  const handleExportReviews = (fmt: "csv" | "xlsx") => {
    const ids = restaurantIds || filteredRestaurants.map((r) => r.id);
    if (!ids || ids.length === 0) return;
    exportReviews(
      {
        restaurantIds: ids as string[],
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        platform: selectedPlatform,
        restaurants: filteredRestaurants.map((r) => ({ id: r.id, name: r.name })),
      },
      fmt
    );
  };

  // Loading state depends on active tab
  const isLoading = 
    (activeTab === "overview" && isLoadingOverviewStats) ||
    (activeTab === "customers" && isLoadingExtended) ||
    (activeTab === "menu" && isLoadingMenuItems) ||
    (activeTab === "weather" && isLoadingExtended);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Chargement des avis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tabs + Date Toggle sur la même ligne */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <TabsList className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted/60 p-1 border border-border/40">
            <TabsTrigger 
              value="overview" 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                         data-[state=active]:bg-background data-[state=active]:text-foreground 
                         data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50
                         hover:text-foreground hover:bg-background/50"
            >
              <Eye className="h-3.5 w-3.5" />
              Aperçu
            </TabsTrigger>
            <TabsTrigger 
              value="customers" 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                         data-[state=active]:bg-background data-[state=active]:text-foreground 
                         data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50
                         hover:text-foreground hover:bg-background/50"
            >
              <Users className="h-3.5 w-3.5" />
              Clients
            </TabsTrigger>
            <TabsTrigger 
              value="menu" 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                         data-[state=active]:bg-background data-[state=active]:text-foreground 
                         data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50
                         hover:text-foreground hover:bg-background/50"
            >
              <ChefHat className="h-3.5 w-3.5" />
              Plats
            </TabsTrigger>
            <TabsTrigger 
              value="weather" 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                         data-[state=active]:bg-background data-[state=active]:text-foreground 
                         data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50
                         hover:text-foreground hover:bg-background/50"
            >
              <Cloud className="h-3.5 w-3.5" />
              Météo
            </TabsTrigger>
          </TabsList>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExportingData}>
                  <Download className="h-4 w-4 mr-2" />
                  {isExportingData ? "Export..." : "Exporter"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportReviews("xlsx")}>
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportReviews("csv")}>
                  CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Toggle Date intégré */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-xs">Par :</span>
            <ToggleGroup 
              type="single" 
              value={dateMode} 
              onValueChange={(value) => value && setDateMode(value as DateMode)}
              className="bg-muted/60 rounded-md p-0.5 border border-border/40"
            >
              <ToggleGroupItem 
                value="order" 
                className="flex items-center gap-1 px-2 py-1 text-xs rounded data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground transition-all"
              >
                <CalendarDays className="h-3 w-3" />
                Commande
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="review" 
                className="flex items-center gap-1 px-2 py-1 text-xs rounded data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground transition-all"
              >
                <MessageSquare className="h-3 w-3" />
                Avis
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <TabsContent value="overview" className="mt-6">
          <ReviewsOverview 
            reviews={customerReviews || []} 
            allReviewsForRolling={extendedReviews || []}
            dateMode={dateMode}
            overviewStats={overviewStats}
          />
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <ReviewsCustomerList reviews={customerReviews || []} />
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          <ReviewsMenuItems reviews={menuItemReviews || []} restaurants={filteredRestaurants} />
        </TabsContent>


        <TabsContent value="weather" className="mt-6">
          <WeatherCorrelation 
            startDate={startDate}
            endDate={endDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
