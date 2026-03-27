import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Clock, AlertTriangle, CheckCircle, TrendingDown, LineChart as LineChartIcon, BarChart3, ChevronLeft, ChevronRight, Timer, Store, Building2, Crown, Truck } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { checkRestaurantOpeningDate } from "@/lib/restaurantOpeningDates";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceArea,
  LabelList,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { WaitTimeAnalytics } from "./WaitTimeAnalytics";
import { PrepTimeAnalytics } from "./PrepTimeAnalytics";
import { OrderAccuracyDashboard } from "@/components/operations/OrderAccuracyDashboard";
import { UberOneAnalysis } from "./UberOneAnalysis";
import { TotalDeliveryTimeAnalytics } from "./TotalDeliveryTimeAnalytics";


export function OperationsAnalytics() {
  const {
    selectedRestaurants,
    selectedPlatform,
    selectedYear,
    selectedMonth,
    periodMode,
    setPeriodMode,
    setSelectedMonth,
    dateRange: contextDateRange,
    isNetworkView,
    selectedChainId,
  } = useAnalyticsContext();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"availability" | "prepTime" | "waitTime" | "totalDelivery" | "orderErrors" | "uberOne">(() => {
    const stored = localStorage.getItem("operations-active-tab");
    if (stored === "availability" || stored === "prepTime" || stored === "waitTime" || stored === "totalDelivery" || stored === "orderErrors" || stored === "uberOne") {
      return stored;
    }
    return "availability";
  });
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // format "yyyy-MM-dd"

  // Initialize from URL parameters for drill-down navigation
  useEffect(() => {
    const dayParam = searchParams.get("day");
    const tabParam = searchParams.get("tab");

    // Handle tab parameter for navigation from comparison pages
    if (tabParam === "orderErrors" || tabParam === "availability" || tabParam === "waitTime" || tabParam === "prepTime" || tabParam === "totalDelivery" || tabParam === "uberOne") {
      setActiveTab(tabParam);
      localStorage.setItem("operations-active-tab", tabParam);
    }

    if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
      setSelectedDay(dayParam);
      // Also set periodMode to month if coming from external navigation
      if (periodMode === "year") {
        const targetMonth = parseInt(dayParam.substring(5, 7), 10);
        setPeriodMode("month");
        setSelectedMonth(targetMonth);
      }
    }

    // Clean URL after initialization
    if (dayParam || tabParam) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Persist active sub-tab
  useEffect(() => {
    localStorage.setItem("operations-active-tab", activeTab);
  }, [activeTab]);

  // Calculate date range using centralized hook (fixes "previous_week" bug)
  const { startDate, endDate } = useDataGranularity({
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange: contextDateRange,
  });

  const dateRange = useMemo(() => ({
    start: startDate,
    end: endDate,
  }), [startDate, endDate]);

  // Determine if we should use daily view (short periods or month) - must be before queries
  const useDailyView = periodMode === "month" || 
                       periodMode === "previous_week" || 
                       periodMode === "7d" || 
                       periodMode === "30d" || 
                       periodMode === "current_month" || 
                       periodMode === "range";

  // Auto-drill into hourly view when period is a single day
  useEffect(() => {
    const start = format(dateRange.start, "yyyy-MM-dd");
    const end = format(dateRange.end, "yyyy-MM-dd");
    if (start === end && useDailyView) {
      setSelectedDay(start);
    } else if (selectedDay && start !== end) {
      setSelectedDay(null);
    }
  }, [dateRange.start, dateRange.end, useDailyView]);

  const platformFilter = (selectedPlatform === "uber_eats" || selectedPlatform === "deliveroo") ? selectedPlatform : null;
  const EMPTY_RESTAURANT_FILTER = ["00000000-0000-0000-0000-000000000000"];

  // Fetch restaurants for names and pinned status (filtered by active chain)
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants_for_ops", selectedChainId],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, is_pinned, is_active");
      if (selectedChainId) {
        query = query.eq("chain_id", selectedChainId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const restaurantMap = useMemo(() => {
    const map = new Map<string, string>();
    restaurants?.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [restaurants]);

  // Compute restaurant filter based on network view toggle
  const pinnedIds = useMemo(() => 
    restaurants?.filter(r => r.is_pinned && r.is_active).map(r => r.id) || []
  , [restaurants]);
  const chainRestaurantIds = useMemo(() => 
    restaurants?.filter(r => r.is_active).map(r => r.id) || []
  , [restaurants]);
  
  const restaurantIdsFilter = useMemo(() => {
    if (selectedRestaurants.length > 0) return selectedRestaurants;
    if (selectedChainId) {
      if (isNetworkView) return chainRestaurantIds.length > 0 ? chainRestaurantIds : EMPTY_RESTAURANT_FILTER;
      return pinnedIds.length > 0 ? pinnedIds : EMPTY_RESTAURANT_FILTER;
    }
    if (isNetworkView) return null; // all restaurants only in all-brands mode
    return pinnedIds.length > 0 ? pinnedIds : null;
  }, [selectedRestaurants, selectedChainId, isNetworkView, pinnedIds, chainRestaurantIds]);

  // Fetch monthly availability via RPC (year view)
  const { data: monthlyRpcData, isLoading: isLoadingMonthly } = useQuery({
    queryKey: ["availability_monthly_rpc", selectedYear, restaurantIdsFilter, platformFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_availability_monthly", {
        p_year: selectedYear,
        p_restaurant_ids: restaurantIdsFilter,
        p_platform: platformFilter,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !useDailyView && !selectedDay,
  });

  // Fetch daily availability via RPC (month/range view)
  const { data: dailyRpcData, isLoading: isLoadingDaily } = useQuery({
    queryKey: ["availability_daily_rpc", dateRange.start, dateRange.end, restaurantIdsFilter, platformFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_availability_daily", {
        p_start_date: format(dateRange.start, "yyyy-MM-dd"),
        p_end_date: format(dateRange.end, "yyyy-MM-dd"),
        p_restaurant_ids: restaurantIdsFilter,
        p_platform: platformFilter,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: useDailyView && !selectedDay,
  });

  // Fetch by-restaurant availability via RPC (ranking)
  const { data: byRestaurantRpcData } = useQuery({
    queryKey: ["availability_by_restaurant_rpc", dateRange.start, dateRange.end, restaurantIdsFilter, platformFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_availability_by_restaurant", {
        p_start_date: format(dateRange.start, "yyyy-MM-dd"),
        p_end_date: format(dateRange.end, "yyyy-MM-dd"),
        p_restaurant_ids: restaurantIdsFilter,
        p_platform: platformFilter,
      });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch heatmap via RPC
  const { data: heatmapRpcData } = useQuery({
    queryKey: ["availability_heatmap_rpc", dateRange.start, dateRange.end, restaurantIdsFilter, platformFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_availability_heatmap", {
        p_start_date: format(dateRange.start, "yyyy-MM-dd"),
        p_end_date: format(dateRange.end, "yyyy-MM-dd"),
        p_restaurant_ids: restaurantIdsFilter,
        p_platform: platformFilter,
      });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch hourly data for day drill-down only (max ~24 rows, direct query is fine)
  const { data: dayDrilldownData, isLoading: isLoadingDay } = useQuery({
    queryKey: ["availability_day_drilldown", selectedDay, restaurantIdsFilter, platformFilter],
    queryFn: async () => {
      let query = supabase
        .from("hourly_availability")
        .select("*")
        .gte("hour_start", `${selectedDay}T00:00:00`)
        .lte("hour_start", `${selectedDay}T23:59:59`);

      if (restaurantIdsFilter) {
        query = query.in("restaurant_id", restaurantIdsFilter);
      }
      if (platformFilter) {
        query = query.eq("platform", platformFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDay,
  });

  const isLoading = isLoadingMonthly || isLoadingDaily || isLoadingDay;


  // Calculate KPIs from RPC data
  const kpis = useMemo(() => {
    let totalOnline = 0;
    let totalOffline = 0;
    const rates: number[] = [];

    const addEntry = (online: number, offline: number) => {
      totalOnline += online;
      totalOffline += offline;
      const total = online + offline;
      rates.push(total > 0 ? (online / total) * 100 : 100);
    };

    if (selectedDay && dayDrilldownData) {
      dayDrilldownData.forEach((d: any) => addEntry(d.online_minutes, d.offline_minutes));
    } else if (useDailyView && dailyRpcData) {
      dailyRpcData.forEach((d: any) => addEntry(Number(d.total_online_minutes) || 0, Number(d.total_offline_minutes) || 0));
    } else if (monthlyRpcData) {
      monthlyRpcData.forEach((d: any) => addEntry(Number(d.total_online_minutes) || 0, Number(d.total_offline_minutes) || 0));
    }

    const avgAvailability = rates.length > 0
      ? rates.reduce((sum, r) => sum + r, 0) / rates.length
      : 100;

    return {
      avgAvailability,
      totalOfflineHours: totalOffline / 60,
      totalOnlineHours: totalOnline / 60,
      incidentCount: 0,
    };
  }, [monthlyRpcData, dailyRpcData, dayDrilldownData, selectedDay, useDailyView]);

  // Monthly evolution from RPC data
  const monthlyEvolution = useMemo(() => {
    const allMonths = Array.from({ length: 12 }, (_, i) => ({
      monthKey: `${selectedYear}-${String(i + 1).padStart(2, '0')}`,
      displayDate: format(new Date(selectedYear, i, 1), "MMM", { locale: fr }),
      availability: null as number | null,
      offlineHours: null as number | null,
      monthIndex: i + 1,
      year: selectedYear,
    }));

    if (!monthlyRpcData || monthlyRpcData.length === 0) return allMonths;

    const rpcMap = new Map<number, { online: number; offline: number }>();
    monthlyRpcData.forEach((d: any) => {
      rpcMap.set(d.month, {
        online: Number(d.total_online_minutes) || 0,
        offline: Number(d.total_offline_minutes) || 0,
      });
    });

    return allMonths.map((month) => {
      const data = rpcMap.get(month.monthIndex);
      if (data) {
        const total = data.online + data.offline;
        return {
          ...month,
          availability: total > 0 ? (data.online / total) * 100 : 100,
          offlineHours: data.offline / 60,
        };
      }
      return month;
    });
  }, [monthlyRpcData, selectedYear]);

  // Daily evolution from RPC data
  const dailyEvolution = useMemo(() => {
    if (!dailyRpcData || dailyRpcData.length === 0) return [];

    return dailyRpcData.map((d: any) => {
      const online = Number(d.total_online_minutes) || 0;
      const offline = Number(d.total_offline_minutes) || 0;
      const total = online + offline;
      const dateStr = d.day;
      return {
        date: dateStr,
        displayDate: format(parseISO(dateStr), "d", { locale: fr }),
        availability: total > 0 ? (online / total) * 100 : 100,
        offlineHours: offline / 60,
      };
    });
  }, [dailyRpcData]);

  // Hourly evolution for a specific day (from raw day drill-down data)
  const hourlyEvolution = useMemo(() => {
    if (!selectedDay || !dayDrilldownData) return [];

    const dayData = dayDrilldownData;

    return Array.from({ length: 24 }, (_, hour) => {
      const hourStr = String(hour).padStart(2, "0");
      const hourData = dayData.filter((d: any) => {
        const hourPart = d.hour_start.substring(11, 13);
        return hourPart === hourStr;
      });

      if (hourData.length === 0) {
        return {
          hour: `${hour}h`,
          hourIndex: hour,
          availability: null,
          offlineMinutes: 0,
          onlineMinutes: 0,
        };
      }

      const online = hourData.reduce((sum: number, d: any) => sum + d.online_minutes, 0);
      const offline = hourData.reduce((sum: number, d: any) => sum + d.offline_minutes, 0);
      const total = online + offline;

      return {
        hour: `${hour}h`,
        hourIndex: hour,
        availability: total > 0 ? (online / total) * 100 : 100,
        offlineMinutes: offline,
        onlineMinutes: online,
      };
    });
  }, [dayDrilldownData, selectedDay]);

  // KPIs for selected day
  const dayKpis = useMemo(() => {
    if (!selectedDay || !hourlyEvolution || hourlyEvolution.length === 0) {
      return null;
    }

    const totalOnline = hourlyEvolution.reduce((sum, d) => sum + d.onlineMinutes, 0);
    const totalOffline = hourlyEvolution.reduce((sum, d) => sum + d.offlineMinutes, 0);
    const totalMinutes = totalOnline + totalOffline;

    return {
      avgAvailability: totalMinutes > 0 ? (totalOnline / totalMinutes) * 100 : 100,
      totalOfflineMinutes: totalOffline,
      totalOnlineMinutes: totalOnline,
      incidentCount: hourlyEvolution.filter((d) => d.offlineMinutes > 15).length,
    };
  }, [hourlyEvolution, selectedDay]);

  // Select data based on period mode and selectedDay
  const chartData = selectedDay 
    ? hourlyEvolution 
    : useDailyView
      ? dailyEvolution 
      : monthlyEvolution;

  // Handle click on chart point for drill-down
  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      const payload = data.activePayload[0].payload;
      
      if (periodMode === "year" && payload.monthIndex) {
        setPeriodMode("month");
        setSelectedMonth(payload.monthIndex);
        setSelectedDay(null);
      } else if (useDailyView && payload.date && !selectedDay) {
        setSelectedDay(payload.date);
      }
    }
  };

  // Navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleBackToYear = () => {
    setPeriodMode("year");
    setSelectedDay(null);
  };

  const handleBackToMonth = () => {
    setSelectedDay(null);
  };

  const handlePrevDay = () => {
    if (selectedDay) {
      const newDay = subDays(parseISO(selectedDay), 1);
      setSelectedDay(format(newDay, "yyyy-MM-dd"));
    }
  };

  const handleNextDay = () => {
    if (selectedDay) {
      const newDay = addDays(parseISO(selectedDay), 1);
      setSelectedDay(format(newDay, "yyyy-MM-dd"));
    }
  };

  // Get dynamic Y-axis domain (filter out null values)
  const getYAxisDomain = (): [number, number] => {
    const validData = chartData.filter((d: any) => d.availability !== null);
    if (validData.length === 0) return [90, 100];
    const minValue = Math.min(...validData.map((d: any) => d.availability as number));
    const lowerBound = Math.max(0, Math.floor(minValue / 5) * 5 - 5);
    return [lowerBound, 100];
  };

  // Get XAxis dataKey based on current view
  const getXAxisDataKey = () => {
    if (selectedDay) return "hour";
    return "displayDate";
  };

  // Check if clicking on chart should enable cursor pointer
  const isChartClickable = () => {
    if (selectedDay) return false;
    if (useDailyView) return true;
    return true;
  };

  // Get chart title based on current view
  const getChartTitle = () => {
    if (selectedDay) {
      return format(parseISO(selectedDay), "EEEE d MMMM yyyy", { locale: fr });
    }
    if (periodMode === "month") {
      return format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", { locale: fr });
    }
    if (periodMode === "previous_week" || periodMode === "7d" || periodMode === "30d" || periodMode === "current_month" || periodMode === "range") {
      if (dateRange.start && dateRange.end) {
        return `Du ${format(dateRange.start, "d MMM", { locale: fr })} au ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
      }
    }
    return "Évolution du taux de disponibilité";
  };

  // Get current KPIs based on view
  const displayKpis = selectedDay && dayKpis ? dayKpis : kpis;

  // Use darker, more contrasting colors for bars
  const getBarColor = (value: number) => {
    if (value >= 98) return "hsl(142, 76%, 30%)";
    if (value >= 95) return "hsl(38, 92%, 50%)";
    return "hsl(0, 84%, 50%)";
  };

  // Hourly heatmap data from RPC
  const hourlyHeatmap = useMemo(() => {
    if (!heatmapRpcData || heatmapRpcData.length === 0) return [];

    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    
    // Build lookup map
    const lookup = new Map<string, number>();
    heatmapRpcData.forEach((d: any) => {
      lookup.set(`${d.day_of_week}-${d.hour}`, Number(d.avg_offline_minutes) || 0);
    });

    const result: { day: string; hour: number; avgOffline: number; dayIndex: number }[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        result.push({
          day: days[day],
          hour,
          avgOffline: lookup.get(`${day}-${hour}`) || 0,
          dayIndex: day,
        });
      }
    }
    return result;
  }, [heatmapRpcData]);

  // Restaurant ranking from RPC
  const restaurantRanking = useMemo(() => {
    if (!byRestaurantRpcData || byRestaurantRpcData.length === 0) return [];

    return byRestaurantRpcData.map((d: any) => {
      const online = Number(d.total_online_minutes) || 0;
      const offline = Number(d.total_offline_minutes) || 0;
      const total = online + offline;
      return {
        id: d.restaurant_id,
        name: restaurantMap.get(d.restaurant_id) || d.restaurant_id.slice(0, 8),
        availability: total > 0 ? (online / total) * 100 : 100,
        offlineHours: offline / 60,
      };
    }).sort((a: any, b: any) => a.availability - b.availability);
  }, [byRestaurantRpcData, restaurantMap]);

  const topFlop = useMemo(() => {
    const sorted = [...restaurantRanking].sort((a, b) => b.availability - a.availability);
    return {
      top5: sorted.slice(0, 5),
      flop5: sorted.slice(-5).reverse(),
    };
  }, [restaurantRanking]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if we have any data from the active RPC source
  const hasAvailabilityData = selectedDay 
    ? (dayDrilldownData && dayDrilldownData.length > 0)
    : useDailyView 
      ? (dailyRpcData && dailyRpcData.length > 0)
      : (monthlyRpcData && monthlyRpcData.length > 0);

  const getAvailabilityColor = (value: number) => {
    if (value >= 98) return "hsl(var(--chart-2))"; // Green
    if (value >= 95) return "hsl(var(--chart-4))"; // Amber
    return "hsl(var(--destructive))"; // Red
  };

  const getHeatmapColor = (offlineMinutes: number) => {
    if (offlineMinutes === 0) return "hsl(var(--chart-2) / 0.3)";
    if (offlineMinutes < 5) return "hsl(var(--chart-4) / 0.5)";
    if (offlineMinutes < 15) return "hsl(var(--chart-4))";
    if (offlineMinutes < 30) return "hsl(var(--destructive) / 0.7)";
    return "hsl(var(--destructive))";
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs for Operations */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "availability" | "prepTime" | "waitTime" | "totalDelivery" | "orderErrors" | "uberOne")} className="w-full">
        <TabsList className="flex flex-wrap w-full max-w-5xl h-auto gap-1 bg-muted/50 backdrop-blur-sm border border-border/50 p-1 rounded-xl">
          <TabsTrigger 
            value="availability" 
            className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-lg transition-all duration-200"
          >
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Disponibilité</span>
            <span className="sm:hidden">Dispo</span>
          </TabsTrigger>
          <TabsTrigger 
            value="prepTime" 
            className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-lg transition-all duration-200"
          >
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Prépa initial</span>
            <span className="sm:hidden">Prépa init.</span>
          </TabsTrigger>
          <TabsTrigger 
            value="waitTime" 
            className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-lg transition-all duration-200"
          >
            <Timer className="h-4 w-4" />
            <span className="hidden sm:inline">Attente coursier</span>
            <span className="sm:hidden">Attente coursier</span>
          </TabsTrigger>
          <TabsTrigger 
            value="totalDelivery" 
            className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-lg transition-all duration-200"
          >
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Temps de prépa total</span>
            <span className="sm:hidden">Prépa total</span>
          </TabsTrigger>
          <TabsTrigger 
            value="orderErrors" 
            className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-lg transition-all duration-200"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Erreurs</span>
            <span className="sm:hidden">Erreurs</span>
          </TabsTrigger>
          <TabsTrigger 
            value="uberOne" 
            className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-lg transition-all duration-200"
          >
            <Crown className="h-4 w-4" />
            <span className="hidden sm:inline">Uber One</span>
            <span className="sm:hidden">U1</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prepTime" className="mt-6">
          <PrepTimeAnalytics />
        </TabsContent>

        <TabsContent value="waitTime" className="mt-6">
          <WaitTimeAnalytics />
        </TabsContent>

        <TabsContent value="orderErrors" className="mt-6">
          <OrderAccuracyDashboard
            selectedRestaurants={selectedRestaurants}
            selectedYear={selectedYear}
            selectedMonth={periodMode === "month" ? selectedMonth : "all"}
            restaurants={restaurants || []}
            periodMode={periodMode}
            dateRange={
              periodMode === "range" ||
              periodMode === "previous_week" ||
              periodMode === "7d" ||
              periodMode === "30d" ||
              periodMode === "current_month"
                ? dateRange
                : undefined
            }
          />
        </TabsContent>

        <TabsContent value="totalDelivery" className="mt-6">
          <TotalDeliveryTimeAnalytics />
        </TabsContent>

        <TabsContent value="uberOne" className="mt-6">
          <UberOneAnalysis />
        </TabsContent>

        <TabsContent value="availability" className="mt-6 space-y-6">
          {!hasAvailabilityData ? (
            (() => {
              const openingCheck = checkRestaurantOpeningDate(
                restaurants || [],
                selectedRestaurants,
                format(dateRange.end, "yyyy-MM-dd")
              );
              
              if (openingCheck.isBeforeOpening) {
                return (
                  <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Building2 className="h-12 w-12 text-blue-500 mb-4" />
                      <p className="text-lg font-medium mb-2">Point de vente récent</p>
                      <p className="text-muted-foreground text-center max-w-md">
                        Le restaurant <span className="font-semibold text-foreground">{openingCheck.cityName}</span> a ouvert ses portes le <span className="font-semibold text-foreground">1er novembre 2025</span>. 
                        Les données ne sont disponibles qu'à partir de cette date.
                      </p>
                    </CardContent>
                  </Card>
                );
              }
              
              return (
                <div className="text-center py-20 space-y-4">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                  <p className="text-lg text-muted-foreground">
                    Aucune donnée de disponibilité pour cette période.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Importez un fichier "Temps d'inactivité" depuis la page Import Rapports.
                  </p>
                </div>
              );
            })()
          ) : (
            <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taux de disponibilité
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: getAvailabilityColor(displayKpis.avgAvailability) }}>
              {displayKpis.avgAvailability.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedDay ? "Ce jour" : "Moyenne sur la période"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {selectedDay ? "Minutes en ligne" : "Heures en ligne"}
            </CardTitle>
            <Clock className="h-5 w-5 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {selectedDay && dayKpis
                ? `${dayKpis.totalOnlineMinutes}min`
                : `${kpis.totalOnlineHours.toFixed(0)}h`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Temps de fonctionnement
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {selectedDay ? "Minutes hors ligne" : "Heures hors ligne"}
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {selectedDay && dayKpis
                ? `${dayKpis.totalOfflineMinutes}min`
                : `${kpis.totalOfflineHours.toFixed(1)}h`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Temps d'indisponibilité
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Incidents (&gt;15min)
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-4">
              {displayKpis.incidentCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedDay ? "Heures problématiques" : "Périodes hors ligne significatives"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Availability Evolution Chart */}
      <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            {/* Back button */}
            {selectedDay ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToMonth}
                className="h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Retour au mois
              </Button>
            ) : periodMode === "month" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToYear}
                className="h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
            ) : null}

            <CardTitle className="capitalize">
              {getChartTitle()}
            </CardTitle>

            {/* Navigation arrows */}
            {selectedDay ? (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : periodMode === "month" ? (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={chartType === "line" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setChartType("line")}
            >
              <LineChartIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === "bar" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setChartType("bar")}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="w-full">
          <ChartContainer
            config={{
              availability: { label: "Disponibilité", color: "hsl(var(--chart-2))" },
            }}
            className="h-[300px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "line" ? (
                <LineChart 
                  data={chartData} 
                  onClick={handleChartClick} 
                  style={{ cursor: isChartClickable() ? "pointer" : "default" }}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                >
                  <ReferenceArea y1={98} y2={100} fill="hsl(var(--chart-2))" fillOpacity={0.1} />
                  <ReferenceArea y1={95} y2={98} fill="hsl(var(--chart-4))" fillOpacity={0.1} />
                  <ReferenceArea y1={0} y2={95} fill="hsl(var(--destructive))" fillOpacity={0.05} />
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey={getXAxisDataKey()} 
                    className="text-xs" 
                    tick={{ fontSize: 11 }}
                    interval={selectedDay ? 1 : 0}
                  />
                  <YAxis domain={getYAxisDomain()} className="text-xs" tickFormatter={(v) => `${v}%`} width={45} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, props) => {
                          if (value === null) return ["Pas de données", ""];
                          const entry = props.payload;
                          if (selectedDay && entry?.offlineMinutes !== undefined) {
                            return [
                              `${Number(value).toFixed(1)}% (${entry.offlineMinutes}min offline)`,
                              "Disponibilité"
                            ];
                          }
                          return [`${Number(value).toFixed(1)}%`, "Disponibilité"];
                        }}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="availability"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--chart-2))", cursor: isChartClickable() ? "pointer" : "default" }}
                    activeDot={{ r: 6, cursor: isChartClickable() ? "pointer" : "default" }}
                    connectNulls={true}
                  />
                </LineChart>
              ) : (
                <BarChart 
                  data={chartData} 
                  onClick={handleChartClick} 
                  style={{ cursor: isChartClickable() ? "pointer" : "default" }}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                >
                  <ReferenceArea y1={98} y2={100} fill="hsl(var(--chart-2))" fillOpacity={0.03} />
                  <ReferenceArea y1={95} y2={98} fill="hsl(var(--chart-4))" fillOpacity={0.03} />
                  <ReferenceArea y1={0} y2={95} fill="hsl(var(--destructive))" fillOpacity={0.02} />
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey={getXAxisDataKey()} 
                    className="text-xs" 
                    tick={{ fontSize: 11 }}
                    interval={selectedDay ? 1 : 0}
                  />
                  <YAxis domain={getYAxisDomain()} className="text-xs" tickFormatter={(v) => `${v}%`} width={45} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, props) => {
                          if (value === null) return ["Pas de données", ""];
                          const entry = props.payload;
                          if (selectedDay && entry?.offlineMinutes !== undefined) {
                            return [
                              `${Number(value).toFixed(1)}% (${entry.offlineMinutes}min offline)`,
                              "Disponibilité"
                            ];
                          }
                          return [`${Number(value).toFixed(1)}%`, "Disponibilité"];
                        }}
                      />
                    }
                  />
                  <Bar 
                    dataKey="availability" 
                    radius={[4, 4, 0, 0]} 
                    cursor={isChartClickable() ? "pointer" : "default"}
                    stroke="#fff"
                    strokeWidth={1}
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.availability !== null ? getBarColor(entry.availability) : "transparent"} 
                      />
                    ))}
                    <LabelList
                      dataKey="availability"
                      position="top"
                      formatter={(value: number | null) => 
                        value !== null ? `${value.toFixed(1)}%` : ""
                      }
                      style={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    />
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </ChartContainer>
          {!selectedDay && periodMode === "year" && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Cliquez sur un mois pour voir le détail jour par jour
            </p>
          )}
          {!selectedDay && periodMode === "month" && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Cliquez sur un jour pour voir le détail heure par heure
            </p>
          )}
          {selectedDay && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Détail heure par heure
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Heatmap */}
        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Heatmap horaire (minutes hors ligne moyennes)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex gap-1 text-xs text-muted-foreground mb-2">
                <div className="w-10" />
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="flex-1 text-center">
                    {i % 4 === 0 ? `${i}h` : ""}
                  </div>
                ))}
              </div>
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day, dayIdx) => {
                const adjustedDayIdx = dayIdx === 6 ? 0 : dayIdx + 1; // Convert to JS day format
                return (
                  <div key={day} className="flex gap-1 items-center">
                    <div className="w-10 text-xs text-muted-foreground">{day}</div>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const data = hourlyHeatmap.find(
                        (h) => h.dayIndex === adjustedDayIdx && h.hour === hour
                      );
                      return (
                        <div
                          key={hour}
                          className="flex-1 h-6 rounded-sm transition-colors"
                          style={{ backgroundColor: getHeatmapColor(data?.avgOffline || 0) }}
                          title={`${day} ${hour}h: ${(data?.avgOffline || 0).toFixed(1)} min hors ligne`}
                        />
                      );
                    })}
                  </div>
                );
              })}
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(0) }} />
                  0 min
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(10) }} />
                  5-15 min
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(30) }} />
                  &gt;30 min
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restaurant Ranking */}
        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Classement par disponibilité</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topFlop.flop5.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    À surveiller (moins disponibles)
                  </h4>
                  <div className="space-y-2">
                    {topFlop.flop5.map((r, idx) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 border border-destructive/20"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="text-sm font-medium truncate max-w-[250px]">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {r.offlineHours.toFixed(1)}h offline
                          </span>
                          <span
                            className="text-sm font-bold"
                            style={{ color: getAvailabilityColor(r.availability) }}
                          >
                            {r.availability.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {topFlop.top5.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-chart-2 mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Meilleures performances
                  </h4>
                  <div className="space-y-2">
                    {topFlop.top5.map((r, idx) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-chart-2/10 border border-chart-2/20"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="text-sm font-medium truncate max-w-[250px]">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {r.offlineHours.toFixed(1)}h offline
                          </span>
                          <span
                            className="text-sm font-bold"
                            style={{ color: getAvailabilityColor(r.availability) }}
                          >
                            {r.availability.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
