import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Truck } from "lucide-react";
import { ObjectiveSlider } from "@/components/compare/ObjectiveSlider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TotalDeliveryTimeFullRankingTable } from "@/components/compare/TotalDeliveryTimeFullRankingTable";
import { TotalDeliveryTimeInsightsSection } from "@/components/compare/TotalDeliveryTimeInsightsSection";
import { TotalDeliveryTimeHeatmapGrid } from "@/components/compare/TotalDeliveryTimeHeatmapGrid";
import { NetworkViewToggle } from "@/components/compare/NetworkViewToggle";
import { OverviewPeriodSelector, OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { useTotalDeliveryTimeExport } from "@/hooks/useTotalDeliveryTimeExport";
import { filterActiveRestaurants } from "@/lib/restaurantActivityFilter";
import type { DateRange } from "react-day-picker";

const STORAGE_KEY = "total-delivery-time-comparison-state";

const getInitialState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        periodMode: parsed.periodMode || "previous_week",
        selectedYear: parsed.selectedYear || new Date().getFullYear(),
        selectedMonth: parsed.selectedMonth || new Date().getMonth() + 1,
        customDateRange: parsed.customDateRange ? {
          from: parsed.customDateRange.from ? new Date(parsed.customDateRange.from) : undefined,
          to: parsed.customDateRange.to ? new Date(parsed.customDateRange.to) : undefined,
        } : undefined,
        isNetworkView: parsed.isNetworkView || false,
        objective: parsed.objective ?? 15,
      };
    }
  } catch {
    // ignore
  }
  return null;
};

const TotalDeliveryTimeComparison = () => {
  const navigate = useNavigate();
  const { 
    selectedPlatform: contextPlatform,
    setSelectedPlatform: setContextPlatform,
  } = useAnalyticsContext();
  
  const { exportToPDF, isExporting } = useTotalDeliveryTimeExport();
  
  // Initialize state from localStorage
  const initialState = getInitialState();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>(
    initialState?.periodMode || "previous_week"
  );
  const [selectedYear, setSelectedYear] = useState(
    initialState?.selectedYear || currentYear
  );
  const [selectedMonth, setSelectedMonth] = useState(
    initialState?.selectedMonth || currentMonth
  );
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(
    initialState?.customDateRange
  );
  const [isNetworkView, setIsNetworkView] = useState(
    initialState?.isNetworkView || false
  );
  const [objective, setObjective] = useState(
    initialState?.objective ?? 15
  );

  // Persist state to localStorage
  useEffect(() => {
    const state = {
      periodMode,
      selectedYear,
      selectedMonth,
      customDateRange: customDateRange ? {
        from: customDateRange.from?.toISOString(),
        to: customDateRange.to?.toISOString(),
      } : undefined,
      isNetworkView,
      objective,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [periodMode, selectedYear, selectedMonth, customDateRange, isNetworkView, objective]);

  // Calculate date range based on period mode
  const dateRange = useMemo(() => {
    switch (periodMode) {
      case "previous_week": {
        const lastWeek = subWeeks(today, 1);
        return {
          start: startOfWeek(lastWeek, { weekStartsOn: 1 }),
          end: endOfWeek(lastWeek, { weekStartsOn: 1 }),
        };
      }
      case "7d": {
        return {
          start: subDays(today, 6),
          end: today,
        };
      }
      case "30d": {
        return {
          start: subDays(today, 29),
          end: today,
        };
      }
      case "current_month": {
        return {
          start: startOfMonth(today),
          end: today,
        };
      }
      case "year": {
        const yearStart = new Date(selectedYear, 0, 1);
        const yearEnd = new Date(selectedYear, 11, 31);
        return {
          start: yearStart,
          end: selectedYear === currentYear ? today : yearEnd,
        };
      }
      case "custom_month": {
        const monthStart = startOfMonth(new Date(selectedYear, selectedMonth - 1));
        const monthEnd = endOfMonth(monthStart);
        return {
          start: monthStart,
          end: monthEnd > today ? today : monthEnd,
        };
      }
      case "custom_range": {
        if (customDateRange?.from && customDateRange?.to) {
          return {
            start: customDateRange.from,
            end: customDateRange.to,
          };
        }
        // Fallback to previous week
        const lastWeek = subWeeks(today, 1);
        return {
          start: startOfWeek(lastWeek, { weekStartsOn: 1 }),
          end: endOfWeek(lastWeek, { weekStartsOn: 1 }),
        };
      }
      default: {
        const lastWeek = subWeeks(today, 1);
        return {
          start: startOfWeek(lastWeek, { weekStartsOn: 1 }),
          end: endOfWeek(lastWeek, { weekStartsOn: 1 }),
        };
      }
    }
  }, [periodMode, selectedYear, selectedMonth, customDateRange, today, currentYear]);

  // Fetch pinned restaurants with activity dates
  const { data: pinnedRestaurantsRaw } = useQuery({
    queryKey: ["pinned-restaurants-with-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, uber_opening_date, uber_closing_date, deliveroo_opening_date, deliveroo_closing_date")
        .eq("is_pinned", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all active restaurants (for network view) with activity dates
  const { data: allActiveRestaurantsRaw } = useQuery({
    queryKey: ["active-restaurants-with-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, uber_opening_date, uber_closing_date, deliveroo_opening_date, deliveroo_closing_date")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Filter restaurants by activity dates for the selected period
  const pinnedRestaurants = useMemo(() => {
    if (!pinnedRestaurantsRaw) return [];
    return filterActiveRestaurants(pinnedRestaurantsRaw, dateRange.start, dateRange.end);
  }, [pinnedRestaurantsRaw, dateRange.start, dateRange.end]);

  const allActiveRestaurants = useMemo(() => {
    if (!allActiveRestaurantsRaw) return [];
    return filterActiveRestaurants(allActiveRestaurantsRaw, dateRange.start, dateRange.end);
  }, [allActiveRestaurantsRaw, dateRange.start, dateRange.end]);

  // Select restaurants based on view mode
  const selectedRestaurants = isNetworkView ? allActiveRestaurants : pinnedRestaurants;

  // Fetch order history data for total delivery times with platform filter
  const { data: orderHistoryData, isLoading } = useQuery({
    queryKey: ["total-delivery-time-comparison", selectedRestaurants?.map(r => r.id), dateRange.start, dateRange.end, contextPlatform, isNetworkView],
    queryFn: async () => {
      if (!selectedRestaurants?.length) return [];
      
      const restaurantIds = selectedRestaurants.map(r => r.id);
      let allData: typeof data = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      let data: { restaurant_id: string; total_prep_delivery_time_minutes: number | null; order_datetime: string | null; platform: string | null }[] = [];

      while (hasMore) {
        let query = supabase
          .from("order_history")
          .select("restaurant_id, total_prep_delivery_time_minutes, order_datetime, platform")
          .in("restaurant_id", restaurantIds)
          .gte("order_datetime", dateRange.start.toISOString())
          .lte("order_datetime", dateRange.end.toISOString())
          .not("total_prep_delivery_time_minutes", "is", null);
        
        // Apply platform filter if not global
        if (contextPlatform !== "global") {
          query = query.eq("platform", contextPlatform);
        }
        
        const { data: pageData, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        
        if (pageData && pageData.length > 0) {
          allData = [...allData, ...pageData];
          hasMore = pageData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return allData;
    },
    enabled: !!selectedRestaurants?.length,
  });

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!orderHistoryData?.length || !selectedRestaurants?.length) return [];
    
    const stats = selectedRestaurants.map(restaurant => {
      const restaurantData = orderHistoryData.filter(d => d.restaurant_id === restaurant.id);
      
      // Calculate average total delivery time
      const totalTime = restaurantData.reduce((sum, d) => sum + (d.total_prep_delivery_time_minutes || 0), 0);
      const avgTotalTime = restaurantData.length > 0 ? totalTime / restaurantData.length : 0;
      
      // Group by date for daily evolution
      const dailyData: Record<string, { total: number; count: number }> = {};
      restaurantData.forEach(d => {
        if (!d.order_datetime) return;
        const date = format(parseISO(d.order_datetime), "yyyy-MM-dd");
        if (!dailyData[date]) {
          dailyData[date] = { total: 0, count: 0 };
        }
        dailyData[date].total += d.total_prep_delivery_time_minutes || 0;
        dailyData[date].count += 1;
      });

      // Group by hour for heatmap
      const hourlyData: Record<number, { total: number; count: number }> = {};
      restaurantData.forEach(d => {
        if (!d.order_datetime) return;
        const hour = parseISO(d.order_datetime).getHours();
        if (!hourlyData[hour]) {
          hourlyData[hour] = { total: 0, count: 0 };
        }
        hourlyData[hour].total += d.total_prep_delivery_time_minutes || 0;
        hourlyData[hour].count += 1;
      });

      // Group by day of week - use local timezone for correct day calculation
      const weekdayData: Record<number, { total: number; count: number }> = {};
      restaurantData.forEach(d => {
        if (!d.order_datetime) return;
        const orderDate = new Date(d.order_datetime);
        const weekday = orderDate.getDay();
        if (!weekdayData[weekday]) {
          weekdayData[weekday] = { total: 0, count: 0 };
        }
        weekdayData[weekday].total += d.total_prep_delivery_time_minutes || 0;
        weekdayData[weekday].count += 1;
      });
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        avgTotalTime,
        orderCount: restaurantData.length,
        dailyData,
        hourlyData,
        weekdayData,
      };
    });
    
    // Sort by average total time (fastest first)
    return stats.sort((a, b) => a.avgTotalTime - b.avgTotalTime);
  }, [orderHistoryData, selectedRestaurants]);


  const periodLabel = useMemo(() => {
    return `${format(dateRange.start, "d MMM", { locale: fr })} - ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
  }, [dateRange]);

  // Prepare export data
  const handleExportPDF = () => {
    // Calculate network stats for export
    const totalWeighted = restaurantStats.reduce((sum, s) => sum + s.avgTotalTime * s.orderCount, 0);
    const totalOrders = restaurantStats.reduce((sum, s) => sum + s.orderCount, 0);
    const networkAverage = totalOrders > 0 ? totalWeighted / totalOrders : 0;
    
    const fastRestaurants = restaurantStats.filter(s => s.avgTotalTime <= 30).length;
    const slowRestaurants = restaurantStats.filter(s => s.avgTotalTime > 40).length;
    
    // Find peak hour across all restaurants
    const hourlyTotals: Record<number, { total: number; count: number }> = {};
    restaurantStats.forEach(stat => {
      Object.entries(stat.hourlyData).forEach(([hour, data]) => {
        if (!hourlyTotals[Number(hour)]) {
          hourlyTotals[Number(hour)] = { total: 0, count: 0 };
        }
        hourlyTotals[Number(hour)].total += data.total;
        hourlyTotals[Number(hour)].count += data.count;
      });
    });
    const peakHour = Object.entries(hourlyTotals)
      .filter(([, data]) => data.count > 0)
      .map(([hour, data]) => ({ hour: Number(hour), avg: data.total / data.count }))
      .sort((a, b) => b.avg - a.avg)[0] || null;
    
    // Find worst day of week
    const weekdayTotals: Record<number, { total: number; count: number }> = {};
    restaurantStats.forEach(stat => {
      Object.entries(stat.weekdayData).forEach(([day, data]) => {
        if (!weekdayTotals[Number(day)]) {
          weekdayTotals[Number(day)] = { total: 0, count: 0 };
        }
        weekdayTotals[Number(day)].total += data.total;
        weekdayTotals[Number(day)].count += data.count;
      });
    });
    const peakWeekday = Object.entries(weekdayTotals)
      .filter(([, data]) => data.count > 0)
      .map(([day, data]) => ({ day: Number(day), avg: data.total / data.count }))
      .sort((a, b) => b.avg - a.avg)[0] || null;

    // Distribution by performance (adapted thresholds for total delivery)
    const distribution = [
      { label: "Excellent (≤ 25min)", count: restaurantStats.filter(s => s.avgTotalTime <= 25).length, color: "emerald" },
      { label: "Très bien (25-30min)", count: restaurantStats.filter(s => s.avgTotalTime > 25 && s.avgTotalTime <= 30).length, color: "green" },
      { label: "Bon (30-35min)", count: restaurantStats.filter(s => s.avgTotalTime > 30 && s.avgTotalTime <= 35).length, color: "amber" },
      { label: "À surveiller (35-40min)", count: restaurantStats.filter(s => s.avgTotalTime > 35 && s.avgTotalTime <= 40).length, color: "orange" },
      { label: "Lent (> 40min)", count: restaurantStats.filter(s => s.avgTotalTime > 40).length, color: "red" },
    ];

    // Restaurants with rank
    const restaurants = restaurantStats.map((stat, index) => ({
      rank: index + 1,
      name: stat.name,
      avgTotalTime: stat.avgTotalTime,
      orderCount: stat.orderCount,
    }));

    exportToPDF({
      periodLabel,
      globalStats: {
        avgTotalTime: networkAverage,
        totalOrders,
        fastRestaurants,
        slowRestaurants,
        peakHour,
        peakWeekday,
      },
      distribution,
      restaurants,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Truck className="h-6 w-6 text-violet-500" />
                <h1 className="text-2xl font-bold">Comparaison Temps prépa + livraison</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Analyse de {restaurantStats.length} restaurants | {periodLabel}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <NetworkViewToggle
              isNetworkView={isNetworkView}
              onToggle={setIsNetworkView}
              pinnedCount={pinnedRestaurants?.length || 0}
              networkCount={allActiveRestaurants?.length || 0}
            />
            {/* Platform selector */}
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
              <Button
                variant={contextPlatform === "uber_eats" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 gap-1.5"
                onClick={() => setContextPlatform("uber_eats")}
              >
                <UberEatsIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Uber Eats</span>
              </Button>
              <Button
                variant={contextPlatform === "deliveroo" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 gap-1.5"
                onClick={() => setContextPlatform("deliveroo")}
              >
                <DeliverooIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Deliveroo</span>
              </Button>
              <Button
                variant={contextPlatform === "global" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3"
                onClick={() => setContextPlatform("global")}
              >
                Global
              </Button>
            </div>
            
            <OverviewPeriodSelector
              periodMode={periodMode}
              onPeriodModeChange={setPeriodMode}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              dateRange={customDateRange}
              onDateRangeChange={setCustomDateRange}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Insights Section */}
            <TotalDeliveryTimeInsightsSection stats={restaurantStats} period={periodMode} />

            {/* Objective Slider + Ranking */}
            <div className="space-y-4">
              <div className="flex justify-end">
                <ObjectiveSlider
                  value={objective}
                  onChange={setObjective}
                  min={5}
                  max={30}
                  unit="min"
                />
              </div>
              
              <TotalDeliveryTimeFullRankingTable 
                data={restaurantStats}
                dateRange={dateRange}
                onExportPDF={handleExportPDF}
                isExporting={isExporting}
                objective={objective}
              />
            </div>

            {/* Heatmap */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5 text-violet-500" />
                  Patterns de temps de livraison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TotalDeliveryTimeHeatmapGrid 
                  stats={restaurantStats}
                  dateRange={dateRange}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default TotalDeliveryTimeComparison;
