import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DowntimeRankingBars } from "@/components/compare/DowntimeRankingBars";
import { DowntimeInsightsSection } from "@/components/compare/DowntimeInsightsSection";
import { DowntimeHeatmapGrid } from "@/components/compare/DowntimeHeatmapGrid";
import { NetworkViewToggle } from "@/components/compare/NetworkViewToggle";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import { useDowntimeExport } from "@/hooks/useDowntimeExport";
import { extractCityName } from "@/lib/restaurantUtils";
import { filterActiveRestaurants } from "@/lib/restaurantActivityFilter";
import type { DateRange } from "react-day-picker";

const STORAGE_KEY = "downtime-comparison-state";

const getInitialState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const DowntimeComparison = () => {
  const navigate = useNavigate();
  const storedState = getInitialState();
  
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>(
    () => storedState?.periodMode || "previous_week"
  );
  const [selectedYear, setSelectedYear] = useState(
    () => storedState?.selectedYear || new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState(
    () => storedState?.selectedMonth || new Date().getMonth() + 1
  );
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(() => {
    if (storedState?.customDateRange?.from && storedState?.customDateRange?.to) {
      return {
        from: new Date(storedState.customDateRange.from),
        to: new Date(storedState.customDateRange.to),
      };
    }
    return undefined;
  });
  const [isNetworkView, setIsNetworkView] = useState(
    () => storedState?.isNetworkView ?? false
  );

  const { exportPdf, exportExcel, isExporting } = useDowntimeExport();
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
    const now = new Date();
    let start: Date;
    let end: Date;
    
    switch (periodMode) {
      case "previous_week": {
        const lastWeek = subWeeks(now, 1);
        start = startOfWeek(lastWeek, { weekStartsOn: 1 });
        end = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      }
      case "7d":
        start = subDays(now, 6);
        end = now;
        break;
      case "30d":
        start = subDays(now, 29);
        end = now;
        break;
      case "current_month":
        start = startOfMonth(now);
        end = now;
        break;
      case "year":
        start = new Date(selectedYear, 0, 1);
        end = new Date(selectedYear, 11, 31);
        break;
      case "custom_month":
        start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
        end = endOfMonth(start);
        break;
      case "custom_range":
        if (customDateRange?.from && customDateRange?.to) {
          start = customDateRange.from;
          end = customDateRange.to;
        } else {
          start = subDays(now, 30);
          end = now;
        }
        break;
      default:
        start = subDays(now, 30);
        end = now;
    }
    
    return { start, end };
  }, [periodMode, selectedYear, selectedMonth, customDateRange]);

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

  // Fetch hourly availability data for selected restaurants with pagination
  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ["downtime-comparison", selectedRestaurants?.map(r => r.id), dateRange.start, dateRange.end, isNetworkView],
    queryFn: async () => {
      if (!selectedRestaurants?.length) return [];
      
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
      const { data, error } = await supabase
        .from("hourly_availability")
        .select("*")
        .in("restaurant_id", selectedRestaurants.map(r => r.id))
        .eq("platform", "uber_eats")
        .gte("hour_start", format(dateRange.start, "yyyy-MM-dd"))
          .lte("hour_start", format(dateRange.end, "yyyy-MM-dd'T'23:59:59"))
          .order("hour_start", { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === PAGE_SIZE;
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
    if (!selectedRestaurants?.length) return [];
    
    const safeAvailabilityData = availabilityData || [];
    
    const stats = selectedRestaurants.map(restaurant => {
      const restaurantData = safeAvailabilityData.filter(d => d.restaurant_id === restaurant.id);
      const totalOffline = restaurantData.reduce((sum, d) => sum + (d.offline_minutes || 0), 0);
      const totalOnline = restaurantData.reduce((sum, d) => sum + (d.online_minutes || 0), 0);
      const totalMinutes = totalOffline + totalOnline;
      const availabilityRate = totalMinutes > 0 ? ((totalOnline / totalMinutes) * 100) : 100;
      
      // Group by date for daily evolution
      const dailyData: Record<string, number> = {};
      restaurantData.forEach(d => {
        const date = format(parseISO(d.hour_start), "yyyy-MM-dd");
        dailyData[date] = (dailyData[date] || 0) + (d.offline_minutes || 0);
      });

      // Group by hour for heatmap
      const hourlyData: Record<number, number> = {};
      restaurantData.forEach(d => {
        const hour = parseISO(d.hour_start).getHours();
        hourlyData[hour] = (hourlyData[hour] || 0) + (d.offline_minutes || 0);
      });

      // Group by day of week
      const weekdayData: Record<number, number> = {};
      restaurantData.forEach(d => {
        const weekday = parseISO(d.hour_start).getDay();
        weekdayData[weekday] = (weekdayData[weekday] || 0) + (d.offline_minutes || 0);
      });
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        totalOfflineMinutes: totalOffline,
        availabilityRate,
        dailyData,
        hourlyData,
        weekdayData,
      };
    });
    
    return stats.sort((a, b) => a.totalOfflineMinutes - b.totalOfflineMinutes);
  }, [availabilityData, selectedRestaurants]);

  const periodLabel = useMemo(() => {
    return `${format(dateRange.start, "d MMM", { locale: fr })} - ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
  }, [dateRange]);

  // Export handlers
  const handleExportPdf = () => {
    const totalDowntime = restaurantStats.reduce((sum, s) => sum + s.totalOfflineMinutes, 0);
    const avgAvailability = restaurantStats.length > 0
      ? restaurantStats.reduce((sum, s) => sum + s.availabilityRate, 0) / restaurantStats.length
      : 100;
    const perfectCount = restaurantStats.filter(s => s.totalOfflineMinutes === 0).length;
    const bestPerformer = restaurantStats[0] || { name: "-", totalOfflineMinutes: 0 };
    const worstPerformer = restaurantStats[restaurantStats.length - 1] || { name: "-", totalOfflineMinutes: 0 };

    exportPdf({
      title: "Comparaison Temps d'inactivite",
      period: periodLabel,
      dateRange,
      stats: restaurantStats,
      insights: {
        bestPerformer: { name: bestPerformer.name, downtime: bestPerformer.totalOfflineMinutes },
        worstPerformer: { name: worstPerformer.name, downtime: worstPerformer.totalOfflineMinutes },
        totalDowntime,
        avgAvailability,
        perfectCount,
      },
    });
  };

  const handleExportExcel = () => {
    const totalDowntime = restaurantStats.reduce((sum, s) => sum + s.totalOfflineMinutes, 0);
    const avgAvailability = restaurantStats.length > 0
      ? restaurantStats.reduce((sum, s) => sum + s.availabilityRate, 0) / restaurantStats.length
      : 100;
    const perfectCount = restaurantStats.filter(s => s.totalOfflineMinutes === 0).length;
    const bestPerformer = restaurantStats[0] || { name: "-", totalOfflineMinutes: 0 };
    const worstPerformer = restaurantStats[restaurantStats.length - 1] || { name: "-", totalOfflineMinutes: 0 };

    exportExcel({
      title: "Comparaison Temps d'inactivite",
      period: periodLabel,
      dateRange,
      stats: restaurantStats,
      insights: {
        bestPerformer: { name: bestPerformer.name, downtime: bestPerformer.totalOfflineMinutes },
        worstPerformer: { name: worstPerformer.name, downtime: worstPerformer.totalOfflineMinutes },
        totalDowntime,
        avgAvailability,
        perfectCount,
      },
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
              <h1 className="text-2xl font-bold">Comparaison Temps d'inactivité</h1>
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
            
            <Button
              onClick={handleExportPdf}
              disabled={isExporting || restaurantStats.length === 0}
              variant="outline"
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              PDF
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={isExporting || restaurantStats.length === 0}
              variant="outline"
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            
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
            <DowntimeInsightsSection stats={restaurantStats} period={periodMode} />

            {/* Ranking - Full width */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Classement par disponibilité ({restaurantStats.length} restaurants)</CardTitle>
              </CardHeader>
              <CardContent>
                <DowntimeRankingBars stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>

            {/* Heatmap */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Patterns d'inactivité</CardTitle>
              </CardHeader>
              <CardContent>
                <DowntimeHeatmapGrid stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default DowntimeComparison;
