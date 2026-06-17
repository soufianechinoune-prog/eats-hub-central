import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePinnedRestaurants, useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrepTimeFullRankingTable } from "@/components/compare/PrepTimeFullRankingTable";
import { PrepTimeInsightsSection } from "@/components/compare/PrepTimeInsightsSection";
import { PrepTimeHeatmapGrid } from "@/components/compare/PrepTimeHeatmapGrid";
import { NetworkViewToggle } from "@/components/compare/NetworkViewToggle";
import { OverviewPeriodSelector, OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";
import { usePrepTimeExport } from "@/hooks/usePrepTimeExport";
import { filterActiveRestaurants } from "@/lib/restaurantActivityFilter";
import type { DateRange } from "react-day-picker";

const STORAGE_KEY = "prep-time-comparison-state";

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
      };
    }
  } catch {
    // ignore
  }
  return null;
};

const PrepTimeComparison = () => {
  const navigate = useNavigate();
  const { 
    selectedPlatform: contextPlatform,
    setSelectedPlatform: setContextPlatform,
    periodMode: ctxPeriodMode,
    selectedYear: ctxYear,
    selectedMonth: ctxMonth,
    dateRange: ctxDateRange,
  } = useAnalyticsContext();
  
  const { exportToPDF, isExporting } = usePrepTimeExport();
  
  // Initialize state from localStorage
  const initialState = getInitialState();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Map AnalyticsContext periodMode → local OverviewPeriodMode
  const mapCtxPeriod = (m: string | undefined): OverviewPeriodMode => {
    if (!m) return "previous_week";
    if (m === "month") return "custom_month";
    if (m === "range") return "custom_range";
    return m as OverviewPeriodMode;
  };

  // Prefer AnalyticsContext (so navigation from Overview keeps the same period),
  // fallback to localStorage, then defaults.
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>(
    ctxPeriodMode ? mapCtxPeriod(ctxPeriodMode) : (initialState?.periodMode || "previous_week")
  );
  const [selectedYear, setSelectedYear] = useState(
    ctxYear || initialState?.selectedYear || currentYear
  );
  const [selectedMonth, setSelectedMonth] = useState(
    ctxMonth || initialState?.selectedMonth || currentMonth
  );
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(
    ctxDateRange?.from && ctxDateRange?.to ? ctxDateRange : initialState?.customDateRange
  );
  const [isNetworkView, setIsNetworkView] = useState(true);



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
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [periodMode, selectedYear, selectedMonth, customDateRange, isNetworkView]);

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
  const { data: pinnedRestaurantsRaw } = usePinnedRestaurants();
  const { data: allActiveRestaurantsRaw } = useActiveRestaurants();

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

  // Format date as YYYY-MM-DD without UTC conversion
  const formatDateLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Fetch pre-aggregated prep-time data via SECURITY DEFINER RPC (per restaurant/day/hour)
  const { data: aggData, isLoading } = useQuery({
    queryKey: ["prep-time-comparison-rpc", selectedRestaurants?.map(r => r.id), dateRange.start, dateRange.end, contextPlatform, isNetworkView],
    queryFn: async () => {
      if (!selectedRestaurants?.length) return [];
      const restaurantIds = selectedRestaurants.map(r => r.id);
      const platformParam = contextPlatform === "global" ? null : contextPlatform;

      const { data, error } = await supabase.rpc("get_prep_time_daily", {
        p_restaurant_ids: restaurantIds,
        p_start_date: formatDateLocal(dateRange.start),
        p_end_date: formatDateLocal(dateRange.end),
        p_platform: platformParam,
      });
      if (error) throw error;
      return (data || []) as Array<{
        restaurant_id: string;
        day: string;
        hour: number;
        avg_prep_time: number;
        order_count: number;
      }>;
    },
    enabled: !!selectedRestaurants?.length,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Process aggregated data into per-restaurant stats
  const restaurantStats = useMemo(() => {
    if (!aggData?.length || !selectedRestaurants?.length) return [];

    // Bucket aggregated rows by restaurant
    const byRestaurant = new Map<string, typeof aggData>();
    for (const row of aggData) {
      const arr = byRestaurant.get(row.restaurant_id) || [];
      arr.push(row);
      byRestaurant.set(row.restaurant_id, arr);
    }

    const stats = selectedRestaurants.map(restaurant => {
      const rows = byRestaurant.get(restaurant.id) || [];

      let totalWeighted = 0;
      let orderCount = 0;
      const dailyData: Record<string, { total: number; count: number }> = {};
      const hourlyData: Record<number, { total: number; count: number }> = {};
      const weekdayData: Record<number, { total: number; count: number }> = {};

      for (const r of rows) {
        const cnt = Number(r.order_count) || 0;
        const avg = Number(r.avg_prep_time) || 0;
        const weighted = avg * cnt;
        if (cnt === 0) continue;

        totalWeighted += weighted;
        orderCount += cnt;

        // Daily
        const dayKey = r.day; // already YYYY-MM-DD
        if (!dailyData[dayKey]) dailyData[dayKey] = { total: 0, count: 0 };
        dailyData[dayKey].total += weighted;
        dailyData[dayKey].count += cnt;

        // Hourly
        const h = Number(r.hour);
        if (!hourlyData[h]) hourlyData[h] = { total: 0, count: 0 };
        hourlyData[h].total += weighted;
        hourlyData[h].count += cnt;

        // Weekday (local)
        const [yy, mm, dd] = r.day.split("-").map(Number);
        const weekday = new Date(yy, (mm || 1) - 1, dd || 1).getDay();
        if (!weekdayData[weekday]) weekdayData[weekday] = { total: 0, count: 0 };
        weekdayData[weekday].total += weighted;
        weekdayData[weekday].count += cnt;
      }

      return {
        id: restaurant.id,
        name: restaurant.name,
        avgPrepTime: orderCount > 0 ? totalWeighted / orderCount : 0,
        orderCount,
        dailyData,
        hourlyData,
        weekdayData,
      };
    });

    return stats
      .filter(s => s.orderCount > 0)
      .sort((a, b) => a.avgPrepTime - b.avgPrepTime);
  }, [aggData, selectedRestaurants]);



  const periodLabel = useMemo(() => {
    return `${format(dateRange.start, "d MMM", { locale: fr })} - ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
  }, [dateRange]);

  // Prepare export data
  const handleExportPDF = () => {
    // Calculate network stats for export
    const totalWeighted = restaurantStats.reduce((sum, s) => sum + s.avgPrepTime * s.orderCount, 0);
    const totalOrders = restaurantStats.reduce((sum, s) => sum + s.orderCount, 0);
    const networkAverage = totalOrders > 0 ? totalWeighted / totalOrders : 0;
    
    const fastRestaurants = restaurantStats.filter(s => s.avgPrepTime < 5).length;
    const slowRestaurants = restaurantStats.filter(s => s.avgPrepTime > 8).length;
    
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

    // Distribution by performance
    const distribution = [
      { label: "Excellent (< 4min)", count: restaurantStats.filter(s => s.avgPrepTime <= 4).length, color: "emerald" },
      { label: "Tres bien (4-5min)", count: restaurantStats.filter(s => s.avgPrepTime > 4 && s.avgPrepTime <= 5).length, color: "green" },
      { label: "Bon (5-6min)", count: restaurantStats.filter(s => s.avgPrepTime > 5 && s.avgPrepTime <= 6).length, color: "amber" },
      { label: "A surveiller (6-8min)", count: restaurantStats.filter(s => s.avgPrepTime > 6 && s.avgPrepTime <= 8).length, color: "orange" },
      { label: "Lent (> 8min)", count: restaurantStats.filter(s => s.avgPrepTime > 8).length, color: "red" },
    ];

    // Restaurants with rank
    const restaurants = restaurantStats.map((stat, index) => ({
      rank: index + 1,
      name: stat.name,
      avgPrepTime: stat.avgPrepTime,
      orderCount: stat.orderCount,
    }));

    exportToPDF({
      periodLabel,
      globalStats: {
        avgPrepTime: networkAverage,
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
              onClick={() => navigate("/overview")}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-6 w-6 text-amber-500" />
                <h1 className="text-2xl font-bold">Comparaison Temps de préparation</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Analyse de {restaurantStats.length} restaurants | {periodLabel}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
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
            <PrepTimeInsightsSection stats={restaurantStats} period={periodMode} />

            {/* Ranking - Full Width with Table */}
            <PrepTimeFullRankingTable 
              data={restaurantStats}
              dateRange={dateRange}
              onExportPDF={handleExportPDF}
              isExporting={isExporting}
            />

            {/* Heatmap */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Patterns de préparation</CardTitle>
              </CardHeader>
              <CardContent>
                <PrepTimeHeatmapGrid stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrepTimeComparison;
