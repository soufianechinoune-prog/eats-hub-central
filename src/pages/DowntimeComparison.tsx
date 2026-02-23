import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, FileDown, FileSpreadsheet, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DowntimeRankingBars, type SortDirection } from "@/components/compare/DowntimeRankingBars";
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
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    () => storedState?.sortDirection || "desc"
  );

  const { exportPdf, exportExcel, isExporting } = useDowntimeExport();

  // Fetch earliest available data date
  const { data: earliestDate } = useQuery({
    queryKey: ["downtime-earliest-date"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hourly_availability")
        .select("hour_start")
        .eq("platform", "uber_eats")
        .order("hour_start", { ascending: true })
        .limit(1);
      return data?.[0]?.hour_start ? parseISO(data[0].hour_start) : null;
    },
  });


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
      sortDirection,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [periodMode, selectedYear, selectedMonth, customDateRange, isNetworkView, sortDirection]);

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

  // Determine alert type based on data coverage
  const dataAlert = useMemo(() => {
    if (!earliestDate) return null;
    if (dateRange.end < earliestDate) return "full";
    if (dateRange.start < earliestDate) return "partial";
    return null;
  }, [earliestDate, dateRange]);

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
      
      // Group by date for daily evolution
      const dailyData: Record<string, number> = {};
      restaurantData.forEach(d => {
        const date = d.hour_start.substring(0, 10);
        dailyData[date] = (dailyData[date] || 0) + (d.offline_minutes || 0);
      });

      // Daily availability with online/offline/rate for bar charts
      const dailyAvailability: Record<string, { online: number; offline: number; rate: number }> = {};
      restaurantData.forEach(d => {
        const date = d.hour_start.substring(0, 10);
        if (!dailyAvailability[date]) {
          dailyAvailability[date] = { online: 0, offline: 0, rate: 0 };
        }
        dailyAvailability[date].online += (d.online_minutes || 0);
        dailyAvailability[date].offline += (d.offline_minutes || 0);
      });
      Object.values(dailyAvailability).forEach(v => {
        const total = v.online + v.offline;
        v.rate = total > 0 ? (v.online / total) * 100 : 100;
      });

      // Availability rate = average of daily rates (consistent with Analytics page)
      const dailyRates = Object.values(dailyAvailability).map(v => v.rate);
      const availabilityRate = dailyRates.length > 0
        ? dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length
        : 100;

      // Hourly availability grouped by day for hourly bar charts
      const hourlyByDay: Record<string, Record<number, { online: number; offline: number; rate: number }>> = {};
      restaurantData.forEach(d => {
        const date = d.hour_start.substring(0, 10);
        const hour = parseInt(d.hour_start.substring(11, 13));
        if (!hourlyByDay[date]) hourlyByDay[date] = {};
        if (!hourlyByDay[date][hour]) hourlyByDay[date][hour] = { online: 0, offline: 0, rate: 0 };
        hourlyByDay[date][hour].online += (d.online_minutes || 0);
        hourlyByDay[date][hour].offline += (d.offline_minutes || 0);
      });
      Object.values(hourlyByDay).forEach(hours => {
        Object.values(hours).forEach(v => {
          const total = v.online + v.offline;
          v.rate = total > 0 ? (v.online / total) * 100 : 100;
        });
      });

      // Group by hour for heatmap
      const hourlyData: Record<number, number> = {};
      restaurantData.forEach(d => {
        const hour = parseInt(d.hour_start.substring(11, 13));
        hourlyData[hour] = (hourlyData[hour] || 0) + (d.offline_minutes || 0);
      });

      // Group by day of week
      const weekdayData: Record<number, number> = {};
      restaurantData.forEach(d => {
        const weekday = new Date(d.hour_start.substring(0, 10) + "T12:00:00").getDay();
        weekdayData[weekday] = (weekdayData[weekday] || 0) + (d.offline_minutes || 0);
      });
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        totalOfflineMinutes: totalOffline,
        availabilityRate,
        dailyData,
        dailyAvailability,
        hourlyByDay,
        hourlyData,
        weekdayData,
      };
    });
    
    return stats.sort((a, b) => a.totalOfflineMinutes - b.totalOfflineMinutes);
  }, [availabilityData, selectedRestaurants]);

  const periodLabel = useMemo(() => {
    return `${format(dateRange.start, "d MMM", { locale: fr })} - ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
  }, [dateRange]);

  const imperfectCount = useMemo(() => restaurantStats.filter(s => Math.round(s.availabilityRate * 10) / 10 < 100).length, [restaurantStats]);

  // Unified export handler
  const handleExport = (type: "pdf" | "excel", onlyImperfect: boolean) => {
    const stats = onlyImperfect ? restaurantStats.filter(s => Math.round(s.availabilityRate * 10) / 10 < 100) : restaurantStats;
    if (stats.length === 0) return;

    const totalDowntime = stats.reduce((sum, s) => sum + s.totalOfflineMinutes, 0);
    const avgAvailability = stats.length > 0
      ? stats.reduce((sum, s) => sum + s.availabilityRate, 0) / stats.length
      : 100;
    const perfectCount = stats.filter(s => s.totalOfflineMinutes === 0).length;
    const bestPerformer = stats[0] || { name: "-", totalOfflineMinutes: 0 };
    const worstPerformer = stats[stats.length - 1] || { name: "-", totalOfflineMinutes: 0 };

    const payload = {
      title: onlyImperfect ? "Inactivite - Restaurants hors 100%" : "Comparaison Temps d'inactivite",
      period: periodLabel,
      dateRange,
      stats,
      sortDirection,
      insights: {
        bestPerformer: { name: bestPerformer.name, downtime: bestPerformer.totalOfflineMinutes },
        worstPerformer: { name: worstPerformer.name, downtime: worstPerformer.totalOfflineMinutes },
        totalDowntime,
        avgAvailability,
        perfectCount,
      },
    };

    if (type === "pdf") exportPdf(payload);
    else exportExcel(payload);
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
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isExporting || restaurantStats.length === 0} variant="outline" className="gap-2">
                  <FileDown className="h-4 w-4" />
                  PDF
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => handleExport("pdf", false)}>
                  Tous les restaurants ({restaurantStats.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf", true)} disabled={imperfectCount === 0}>
                  Hors 100% uniquement ({imperfectCount})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isExporting || restaurantStats.length === 0} variant="outline" className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => handleExport("excel", false)}>
                  Tous les restaurants ({restaurantStats.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel", true)} disabled={imperfectCount === 0}>
                  Hors 100% uniquement ({imperfectCount})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
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
        ) : dataAlert === "full" ? (
          <div className="flex flex-col items-center justify-center h-80 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-orange-500" />
            <h2 className="text-xl font-semibold">Aucune donnée disponible</h2>
            <p className="text-muted-foreground max-w-md">
              Aucun historique de disponibilité Uber Eats n'a été importé pour cette période.
              {earliestDate && (
                <> Les données ne sont disponibles qu'à partir du {format(earliestDate, "d MMMM yyyy", { locale: fr })}.</>
              )}
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {dataAlert === "partial" && (
              <Alert variant="destructive" className="border-orange-500/50 bg-orange-50 text-orange-900 dark:bg-orange-950/30 dark:text-orange-200 dark:border-orange-500/30">
                <AlertTriangle className="h-4 w-4 !text-orange-600 dark:!text-orange-400" />
                <AlertTitle>Historique limité</AlertTitle>
                <AlertDescription>
                  Les données de disponibilité Uber Eats ne sont disponibles qu'à partir du {earliestDate ? format(earliestDate, "d MMMM yyyy", { locale: fr }) : "—"}. Les résultats affichés pour la période antérieure peuvent être incomplets ou non représentatifs.
                </AlertDescription>
              </Alert>
            )}

            {/* Insights Section */}
            <DowntimeInsightsSection stats={restaurantStats} period={periodMode} />

            {/* Ranking - Full width */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Classement par disponibilité ({restaurantStats.length} restaurants)</CardTitle>
              </CardHeader>
              <CardContent>
                <DowntimeRankingBars stats={restaurantStats} dateRange={dateRange} sortDirection={sortDirection} onSortDirectionChange={setSortDirection} />
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
