import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileDown, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AnalyticsCharts, ChartActionsConfig, ActionCategoryFilter } from "@/components/analytics/AnalyticsCharts";
import { RestaurantRanking } from "@/components/analytics/RestaurantRanking";
import { useAnalyticsPdfExport } from "@/hooks/useAnalyticsPdfExport";
import { useRestaurantActions } from "@/hooks/useRestaurantActions";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import uberEatsLogo from "@/assets/uber-eats-logo.png";
import deliverooLogo from "@/assets/deliveroo-logo.png";

const DEFAULT_CHART_ACTIONS_CONFIG: ChartActionsConfig = {
  global: true,
  revenue: true,
  conversionFunnel: true,
  conversionRate: true,
  fees: true,
  netPayout: true,
  profitability: true,
};

const MONTHS_FULL = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = (searchParams.get("view") || "overview") as "overview" | "revenue" | "conversion" | "finances";
  
  const {
    selectedRestaurants,
    selectedPlatform,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
  } = useAnalyticsContext();

  const [chartActionsConfig, setChartActionsConfig] = useState<ChartActionsConfig>(() => {
    const saved = localStorage.getItem('analyticsChartActionsConfig');
    if (saved) {
      try {
        return { ...DEFAULT_CHART_ACTIONS_CONFIG, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_CHART_ACTIONS_CONFIG;
      }
    }
    return DEFAULT_CHART_ACTIONS_CONFIG;
  });
  const [selectedCategories, setSelectedCategories] = useState<ActionCategoryFilter>(new Set());

  const chartsRef = useRef<HTMLDivElement>(null);
  const { exportToPdf, isExporting } = useAnalyticsPdfExport();

  const prevYear = selectedYear - 1;

  const handleTabChange = (value: string) => {
    // Tab changes are now handled by Analytics context platform selector
    setSearchParams({ platform: value });
  };

  const handleChartActionsConfigChange = (newConfig: ChartActionsConfig) => {
    setChartActionsConfig(newConfig);
    localStorage.setItem('analyticsChartActionsConfig', JSON.stringify(newConfig));
  };

  const handleGlobalToggleChange = (value: boolean) => {
    handleChartActionsConfigChange({ ...chartActionsConfig, global: value });
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const navigate = useNavigate();

  const handleActionClick = (actionId: string) => {
    // Navigate to actions page with highlight parameter
    navigate(`/actions?highlight=${actionId}`);
  };

  // Fetch restaurant actions for the selected year and platform
  const { data: uberActions } = useRestaurantActions(
    selectedYear,
    selectedRestaurants.length > 0 ? selectedRestaurants : undefined,
    "uber_eats"
  );

  const { data: deliverooActions } = useRestaurantActions(
    selectedYear,
    selectedRestaurants.length > 0 ? selectedRestaurants : undefined,
    "deliveroo"
  );

  const globalActions = useMemo(() => {
    const all = [...(uberActions || []), ...(deliverooActions || [])];
    // Deduplicate by id
    const uniqueMap = new Map();
    all.forEach(a => uniqueMap.set(a.id, a));
    return Array.from(uniqueMap.values());
  }, [uberActions, deliverooActions]);

  // Determine month range based on period mode
  const getEffectiveMonthRange = () => {
    if (periodMode === "year") {
      return { start: 1, end: 12 };
    } else if (periodMode === "month") {
      return { start: selectedMonth, end: selectedMonth };
    } else if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      // For date range, we use full months from start to end
      const startMonth = dateRange.from.getMonth() + 1;
      const endMonth = dateRange.to.getMonth() + 1;
      return { start: startMonth, end: endMonth };
    }
    return { start: 1, end: 12 };
  };

  const { start: effectiveStartMonth, end: effectiveEndMonth } = getEffectiveMonthRange();

  // Sync selectedTab with context platform
  useMemo(() => {
    // Update search params when platform changes from context
    setSearchParams({ platform: selectedPlatform });
  }, [selectedPlatform, setSearchParams]);

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Build filter for restaurants
  const restaurantFilter = selectedRestaurants.length > 0 ? selectedRestaurants : undefined;

  // ========== UBER EATS DATA (Current Year) ==========
  const { data: uberRevenueData, isLoading: loadingUberRevenue } = useQuery({
    queryKey: ["analytics_revenue_uber", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: uberConversionData, isLoading: loadingUberConversion } = useQuery({
    queryKey: ["analytics_conversion_uber", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: uberFeesData, isLoading: loadingUberFees } = useQuery({
    queryKey: ["analytics_fees_uber", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== UBER EATS DATA (Previous Year - N-1) ==========
  const { data: uberPrevRevenueData } = useQuery({
    queryKey: ["analytics_revenue_uber_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: uberPrevConversionData } = useQuery({
    queryKey: ["analytics_conversion_uber_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: uberPrevFeesData } = useQuery({
    queryKey: ["analytics_fees_uber_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "uber_eats")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== DELIVEROO DATA (Current Year) ==========
  const { data: deliverooRevenueData, isLoading: loadingDeliverooRevenue } = useQuery({
    queryKey: ["analytics_revenue_deliveroo", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deliverooConversionData, isLoading: loadingDeliverooConversion } = useQuery({
    queryKey: ["analytics_conversion_deliveroo", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deliverooFeesData, isLoading: loadingDeliverooFees } = useQuery({
    queryKey: ["analytics_fees_deliveroo", restaurantFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", selectedYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== DELIVEROO DATA (Previous Year - N-1) ==========
  const { data: deliverooPrevRevenueData } = useQuery({
    queryKey: ["analytics_revenue_deliveroo_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deliverooPrevConversionData } = useQuery({
    queryKey: ["analytics_conversion_deliveroo_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deliverooPrevFeesData } = useQuery({
    queryKey: ["analytics_fees_deliveroo_prev", restaurantFilter, prevYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", prevYear)
        .eq("platform", "deliveroo")
        .order("month");
      
      if (restaurantFilter) {
        query = query.in("restaurant_id", restaurantFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ========== GLOBAL DATA (Combined) ==========
  const globalRevenueData = useMemo(() => {
    return [...(uberRevenueData || []), ...(deliverooRevenueData || [])];
  }, [uberRevenueData, deliverooRevenueData]);

  const globalConversionData = useMemo(() => {
    return [...(uberConversionData || []), ...(deliverooConversionData || [])];
  }, [uberConversionData, deliverooConversionData]);

  const globalFeesData = useMemo(() => {
    return [...(uberFeesData || []), ...(deliverooFeesData || [])];
  }, [uberFeesData, deliverooFeesData]);

  const globalPrevRevenueData = useMemo(() => {
    return [...(uberPrevRevenueData || []), ...(deliverooPrevRevenueData || [])];
  }, [uberPrevRevenueData, deliverooPrevRevenueData]);

  const globalPrevConversionData = useMemo(() => {
    return [...(uberPrevConversionData || []), ...(deliverooPrevConversionData || [])];
  }, [uberPrevConversionData, deliverooPrevConversionData]);

  const globalPrevFeesData = useMemo(() => {
    return [...(uberPrevFeesData || []), ...(deliverooPrevFeesData || [])];
  }, [uberPrevFeesData, deliverooPrevFeesData]);

  const isLoading = loadingUberRevenue || loadingUberConversion || loadingUberFees ||
                    loadingDeliverooRevenue || loadingDeliverooConversion || loadingDeliverooFees;

  // Get period display string for PDF export
  const getPeriodDisplay = () => {
    if (periodMode === "month") {
      return `${MONTHS_FULL[selectedMonth - 1]} ${selectedYear}`;
    } else if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "dd MMM yyyy", { locale: fr })} - ${format(dateRange.to, "dd MMM yyyy", { locale: fr })}`;
    }
    return `${selectedYear}`;
  };

  const getRestaurantsDisplay = () => {
    if (selectedRestaurants.length === 0) return "Tous les restaurants";
    const names = restaurants?.filter(r => selectedRestaurants.includes(r.id)).map(r => r.name) || [];
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
  };

  const getPlatformDisplay = () => {
    switch (selectedPlatform) {
      case "uber_eats": return "Uber Eats";
      case "deliveroo": return "Deliveroo";
      default: return "Global";
    }
  };

  const handleExportPdf = () => {
    exportToPdf(chartsRef.current, {
      title: "Rapport Analytics",
      subtitle: "CS Delivery Performance",
      period: getPeriodDisplay(),
      restaurants: getRestaurantsDisplay(),
      platform: getPlatformDisplay(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Analyse de vos performances mensuelles
          </p>
        </div>
        <Button
          onClick={handleExportPdf}
          disabled={isExporting || isLoading}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Export en cours...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" />
              Exporter PDF
            </>
          )}
        </Button>
      </div>

      {/* Analytics Header with shared filters */}
      <AnalyticsHeader />

      {/* Actions Toggle */}
      <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <Label htmlFor="show-actions" className="text-sm font-medium cursor-pointer">
            Afficher les actions sur les graphiques
          </Label>
        </div>
        <Switch
          id="show-actions"
          checked={chartActionsConfig.global}
          onCheckedChange={handleGlobalToggleChange}
        />
        <span className="text-xs text-muted-foreground">
          ({(selectedPlatform === "uber_eats" ? uberActions : selectedPlatform === "deliveroo" ? deliverooActions : globalActions)?.length || 0} actions)
        </span>
        {chartActionsConfig.global && (
          <span className="text-xs text-muted-foreground ml-2 border-l pl-3">
            Utilisez ⚡ sur chaque graphique pour affiner
          </span>
        )}
      </div>

      {/* Platform Tabs */}
      <Tabs value={selectedPlatform} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="uber_eats" className="flex items-center gap-2">
            <img src={uberEatsLogo} alt="Uber Eats" className="h-4 w-4 object-contain" />
            <span className="hidden sm:inline">Uber Eats</span>
          </TabsTrigger>
          <TabsTrigger value="deliveroo" className="flex items-center gap-2">
            <img src={deliverooLogo} alt="Deliveroo" className="h-4 w-4 object-contain" />
            <span className="hidden sm:inline">Deliveroo</span>
          </TabsTrigger>
          <TabsTrigger value="global" className="flex items-center gap-2">
            🌐
            <span className="hidden sm:inline">Global</span>
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div ref={chartsRef}>
            {/* Uber Eats Platform */}
            <TabsContent value="uber_eats" className="mt-6 space-y-6">
              {viewMode === "overview" ? (
                <RestaurantRanking
                  restaurants={restaurants}
                  revenueData={uberRevenueData}
                  conversionData={uberConversionData}
                  feesData={uberFeesData}
                  prevRevenueData={uberPrevRevenueData}
                  prevConversionData={uberPrevConversionData}
                  prevFeesData={uberPrevFeesData}
                  startMonth={effectiveStartMonth}
                  endMonth={effectiveEndMonth}
                />
              ) : (
                <AnalyticsCharts
                  revenueData={uberRevenueData}
                  conversionData={uberConversionData}
                  feesData={uberFeesData}
                  prevRevenueData={uberPrevRevenueData}
                  prevConversionData={uberPrevConversionData}
                  prevFeesData={uberPrevFeesData}
                  startMonth={effectiveStartMonth}
                  endMonth={effectiveEndMonth}
                  selectedYear={selectedYear}
                  actions={uberActions}
                  chartActionsConfig={chartActionsConfig}
                  onChartActionsConfigChange={handleChartActionsConfigChange}
                  onActionClick={handleActionClick}
                  selectedCategories={selectedCategories}
                  onCategoryToggle={handleCategoryToggle}
                  viewMode={viewMode}
                />
              )}
            </TabsContent>

            {/* Deliveroo Platform */}
            <TabsContent value="deliveroo" className="mt-6 space-y-6">
              {viewMode === "overview" ? (
                <RestaurantRanking
                  restaurants={restaurants}
                  revenueData={deliverooRevenueData}
                  conversionData={deliverooConversionData}
                  feesData={deliverooFeesData}
                  prevRevenueData={deliverooPrevRevenueData}
                  prevConversionData={deliverooPrevConversionData}
                  prevFeesData={deliverooPrevFeesData}
                  startMonth={effectiveStartMonth}
                  endMonth={effectiveEndMonth}
                />
              ) : (
                <AnalyticsCharts
                  revenueData={deliverooRevenueData}
                  conversionData={deliverooConversionData}
                  feesData={deliverooFeesData}
                  prevRevenueData={deliverooPrevRevenueData}
                  prevConversionData={deliverooPrevConversionData}
                  prevFeesData={deliverooPrevFeesData}
                  startMonth={effectiveStartMonth}
                  endMonth={effectiveEndMonth}
                  selectedYear={selectedYear}
                  actions={deliverooActions}
                  chartActionsConfig={chartActionsConfig}
                  onChartActionsConfigChange={handleChartActionsConfigChange}
                  onActionClick={handleActionClick}
                  selectedCategories={selectedCategories}
                  onCategoryToggle={handleCategoryToggle}
                  viewMode={viewMode}
                />
              )}
            </TabsContent>

            {/* Global Platform */}
            <TabsContent value="global" className="mt-6 space-y-6">
              {viewMode === "overview" ? (
                <RestaurantRanking
                  restaurants={restaurants}
                  revenueData={globalRevenueData}
                  conversionData={globalConversionData}
                  feesData={globalFeesData}
                  prevRevenueData={globalPrevRevenueData}
                  prevConversionData={globalPrevConversionData}
                  prevFeesData={globalPrevFeesData}
                  startMonth={effectiveStartMonth}
                  endMonth={effectiveEndMonth}
                />
              ) : (
                <AnalyticsCharts
                  revenueData={globalRevenueData}
                  conversionData={globalConversionData}
                  feesData={globalFeesData}
                  prevRevenueData={globalPrevRevenueData}
                  prevConversionData={globalPrevConversionData}
                  prevFeesData={globalPrevFeesData}
                  startMonth={effectiveStartMonth}
                  endMonth={effectiveEndMonth}
                  selectedYear={selectedYear}
                  actions={globalActions}
                  chartActionsConfig={chartActionsConfig}
                  onChartActionsConfigChange={handleChartActionsConfigChange}
                  onActionClick={handleActionClick}
                  selectedCategories={selectedCategories}
                  onCategoryToggle={handleCategoryToggle}
                  viewMode={viewMode}
                />
              )}
            </TabsContent>
          </div>
        )}
      </Tabs>
    </div>
  );
}
