import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Clock, AlertTriangle, CheckCircle, TrendingDown, LineChart as LineChartIcon, BarChart3, ChevronLeft, ChevronRight, Timer, Store } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";
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
import { OrderAccuracyDashboard } from "@/components/operations/OrderAccuracyDashboard";

interface AvailabilityData {
  id: string;
  restaurant_id: string;
  hour_start: string;
  menu_availability_minutes: number;
  online_minutes: number;
  offline_minutes: number;
  platform: string;
}

export function OperationsAnalytics() {
  const {
    selectedRestaurants,
    selectedPlatform,
    selectedYear,
    selectedMonth,
    periodMode,
    setPeriodMode,
    setSelectedMonth,
  } = useAnalyticsContext();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"availability" | "waitTime" | "orderErrors">("availability");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // format "yyyy-MM-dd"

  // Initialize from URL parameter "day" for drill-down navigation
  useEffect(() => {
    const dayParam = searchParams.get("day");
    if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
      setSelectedDay(dayParam);
      // Also set periodMode to month if coming from external navigation
      if (periodMode === "year") {
        const targetMonth = parseInt(dayParam.substring(5, 7), 10);
        setPeriodMode("month");
        setSelectedMonth(targetMonth);
      }
      // Clean URL after initialization
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Calculate date range based on period mode
  const dateRange = useMemo(() => {
    if (periodMode === "month") {
      const start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      const end = endOfMonth(new Date(selectedYear, selectedMonth - 1));
      return { start, end };
    }
    // Year view
    const start = new Date(selectedYear, 0, 1);
    const end = new Date(selectedYear, 11, 31);
    return { start, end };
  }, [selectedYear, selectedMonth, periodMode]);

  // Fetch availability data with pagination to overcome 1000 row limit
  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ["hourly_availability", selectedRestaurants, selectedPlatform, dateRange.start, dateRange.end],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: AvailabilityData[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("hourly_availability")
          .select("*")
          .gte("hour_start", format(dateRange.start, "yyyy-MM-dd"))
          .lte("hour_start", format(dateRange.end, "yyyy-MM-dd'T'23:59:59"))
          .order("hour_start", { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        // Only filter by restaurant if specific restaurants are selected
        if (selectedRestaurants.length > 0) {
          query = query.in("restaurant_id", selectedRestaurants);
        }

        // Filter by platform - only uber_eats and deliveroo are valid platform values
        if (selectedPlatform === "uber_eats" || selectedPlatform === "deliveroo") {
          query = query.eq("platform", selectedPlatform);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log("[Operations] Total fetched:", allData.length);
      return allData as AvailabilityData[];
    },
  });

  // Fetch restaurants for names
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants_for_ops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const restaurantMap = useMemo(() => {
    const map = new Map<string, string>();
    restaurants?.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [restaurants]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!availabilityData || availabilityData.length === 0) {
      return {
        avgAvailability: 0,
        totalOfflineHours: 0,
        totalOnlineHours: 0,
        incidentCount: 0,
      };
    }

    const totalOnline = availabilityData.reduce((sum, d) => sum + d.online_minutes, 0);
    const totalOffline = availabilityData.reduce((sum, d) => sum + d.offline_minutes, 0);
    const totalMinutes = totalOnline + totalOffline;

    return {
      avgAvailability: totalMinutes > 0 ? (totalOnline / totalMinutes) * 100 : 0,
      totalOfflineHours: totalOffline / 60,
      totalOnlineHours: totalOnline / 60,
      incidentCount: availabilityData.filter((d) => d.offline_minutes > 15).length,
    };
  }, [availabilityData]);

  // Monthly evolution (for year view) - always show all 12 months
  const monthlyEvolution = useMemo(() => {
    // Create all 12 months for the selected year
    const allMonths = Array.from({ length: 12 }, (_, i) => ({
      monthKey: `${selectedYear}-${String(i + 1).padStart(2, '0')}`,
      displayDate: format(new Date(selectedYear, i, 1), "MMM", { locale: fr }),
      availability: null as number | null,
      offlineHours: null as number | null,
      monthIndex: i + 1,
      year: selectedYear,
    }));

    if (!availabilityData || availabilityData.length === 0) return allMonths;

    // Aggregate real data by month
    const monthlyMap = new Map<string, { online: number; offline: number }>();

    availabilityData.forEach((d) => {
      const monthKey = format(parseISO(d.hour_start), "yyyy-MM");
      const existing = monthlyMap.get(monthKey) || { online: 0, offline: 0 };
      monthlyMap.set(monthKey, {
        online: existing.online + d.online_minutes,
        offline: existing.offline + d.offline_minutes,
      });
    });

    // Merge real data into all months structure
    return allMonths.map((month) => {
      const data = monthlyMap.get(month.monthKey);
      if (data) {
        const total = data.online + data.offline;
        return {
          ...month,
          availability: total > 0 ? (data.online / total) * 100 : 100,
          offlineHours: data.offline / 60,
        };
      }
      return month; // availability stays null
    });
  }, [availabilityData, selectedYear]);

  // Daily evolution (for month view / drill-down)
  const dailyEvolution = useMemo(() => {
    if (!availabilityData || availabilityData.length === 0) return [];

    const dailyMap = new Map<string, { online: number; offline: number }>();

    availabilityData.forEach((d) => {
      const date = format(parseISO(d.hour_start), "yyyy-MM-dd");
      const existing = dailyMap.get(date) || { online: 0, offline: 0 };
      dailyMap.set(date, {
        online: existing.online + d.online_minutes,
        offline: existing.offline + d.offline_minutes,
      });
    });

    return Array.from(dailyMap.entries())
      .map(([date, values]) => {
        const total = values.online + values.offline;
        return {
          date,
          displayDate: format(parseISO(date), "d", { locale: fr }),
          availability: total > 0 ? (values.online / total) * 100 : 100,
          offlineHours: values.offline / 60,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [availabilityData]);

  // Hourly evolution for a specific day (for day drill-down)
  const hourlyEvolution = useMemo(() => {
    if (!selectedDay || !availabilityData) return [];

    const dayData = availabilityData.filter((d) =>
      d.hour_start.startsWith(selectedDay)
    );

    // Create all 24 hours
    return Array.from({ length: 24 }, (_, hour) => {
      const hourStr = String(hour).padStart(2, "0");
      const hourData = dayData.filter((d) => {
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

      const online = hourData.reduce((sum, d) => sum + d.online_minutes, 0);
      const offline = hourData.reduce((sum, d) => sum + d.offline_minutes, 0);
      const total = online + offline;

      return {
        hour: `${hour}h`,
        hourIndex: hour,
        availability: total > 0 ? (online / total) * 100 : 100,
        offlineMinutes: offline,
        onlineMinutes: online,
      };
    });
  }, [availabilityData, selectedDay]);

  // KPIs for selected day
  const dayKpis = useMemo(() => {
    if (!selectedDay || !hourlyEvolution || hourlyEvolution.length === 0) {
      return null;
    }

    const totalOnline = hourlyEvolution.reduce((sum, d) => sum + d.onlineMinutes, 0);
    const totalOffline = hourlyEvolution.reduce((sum, d) => sum + d.offlineMinutes, 0);
    const totalMinutes = totalOnline + totalOffline;

    return {
      avgAvailability: totalMinutes > 0 ? (totalOnline / totalMinutes) * 100 : 0,
      totalOfflineMinutes: totalOffline,
      totalOnlineMinutes: totalOnline,
      incidentCount: hourlyEvolution.filter((d) => d.offlineMinutes > 15).length,
    };
  }, [hourlyEvolution, selectedDay]);

  // Select data based on period mode and selectedDay
  const chartData = selectedDay 
    ? hourlyEvolution 
    : periodMode === "month" 
      ? dailyEvolution 
      : monthlyEvolution;

  // Handle click on chart point for drill-down
  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      const payload = data.activePayload[0].payload;
      
      if (periodMode === "year" && payload.monthIndex) {
        // Click on month -> drill down to days
        setPeriodMode("month");
        setSelectedMonth(payload.monthIndex);
        setSelectedDay(null);
      } else if (periodMode === "month" && payload.date && !selectedDay) {
        // Click on day -> drill down to hours
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
    if (selectedDay) return false; // In day view, no further drill-down
    if (periodMode === "month") return true; // In month view, can drill down to day
    return true; // In year view, can drill down to month
  };

  // Get chart title based on current view
  const getChartTitle = () => {
    if (selectedDay) {
      return format(parseISO(selectedDay), "EEEE d MMMM yyyy", { locale: fr });
    }
    if (periodMode === "month") {
      return format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", { locale: fr });
    }
    return "Évolution du taux de disponibilité";
  };

  // Get current KPIs based on view
  const displayKpis = selectedDay && dayKpis ? dayKpis : kpis;

  // Use darker, more contrasting colors for bars
  const getBarColor = (value: number) => {
    if (value >= 98) return "hsl(142, 76%, 30%)"; // Vert foncé contrasté
    if (value >= 95) return "hsl(38, 92%, 50%)";  // Orange/ambre
    return "hsl(0, 84%, 50%)";                     // Rouge
  };

  // Debug log pour vérifier les données agrégées
  console.log("[Operations] monthlyEvolution:", monthlyEvolution);

  // Hourly heatmap data (hour of day x day of week)
  const hourlyHeatmap = useMemo(() => {
    if (!availabilityData || availabilityData.length === 0) return [];

    const heatmap: Record<string, { offline: number; count: number }> = {};

    availabilityData.forEach((d) => {
      const dateObj = parseISO(d.hour_start);
      const hour = dateObj.getHours();
      const dayOfWeek = dateObj.getDay();
      const key = `${dayOfWeek}-${hour}`;
      
      if (!heatmap[key]) {
        heatmap[key] = { offline: 0, count: 0 };
      }
      heatmap[key].offline += d.offline_minutes;
      heatmap[key].count += 1;
    });

    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const result: { day: string; hour: number; avgOffline: number; dayIndex: number }[] = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        const data = heatmap[key];
        result.push({
          day: days[day],
          hour,
          avgOffline: data ? data.offline / data.count : 0,
          dayIndex: day,
        });
      }
    }

    return result;
  }, [availabilityData]);

  // Restaurant ranking by availability
  const restaurantRanking = useMemo(() => {
    if (!availabilityData || availabilityData.length === 0) return [];

    const restaurantStats = new Map<string, { online: number; offline: number }>();

    availabilityData.forEach((d) => {
      const existing = restaurantStats.get(d.restaurant_id) || { online: 0, offline: 0 };
      restaurantStats.set(d.restaurant_id, {
        online: existing.online + d.online_minutes,
        offline: existing.offline + d.offline_minutes,
      });
    });

    return Array.from(restaurantStats.entries())
      .map(([id, stats]) => {
        const total = stats.online + stats.offline;
        return {
          id,
          name: restaurantMap.get(id) || id.slice(0, 8),
          availability: total > 0 ? (stats.online / total) * 100 : 100,
          offlineHours: stats.offline / 60,
        };
      })
      .sort((a, b) => a.availability - b.availability);
  }, [availabilityData, restaurantMap]);

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

  if (!availabilityData || availabilityData.length === 0) {
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
  }

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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "availability" | "waitTime" | "orderErrors")} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 h-12 bg-muted/50 backdrop-blur-sm border border-border/50 p-1 rounded-xl">
          <TabsTrigger 
            value="availability" 
            className="flex items-center gap-2 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-lg transition-all duration-200"
          >
            <Store className="h-4 w-4" />
            Disponibilité
          </TabsTrigger>
          <TabsTrigger 
            value="waitTime" 
            className="flex items-center gap-2 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-lg transition-all duration-200"
          >
            <Timer className="h-4 w-4" />
            Temps d'attente
          </TabsTrigger>
          <TabsTrigger 
            value="orderErrors" 
            className="flex items-center gap-2 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-lg transition-all duration-200"
          >
            <AlertTriangle className="h-4 w-4" />
            Erreurs commandes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waitTime" className="mt-6">
          <WaitTimeAnalytics />
        </TabsContent>

        <TabsContent value="orderErrors" className="mt-6">
          <OrderAccuracyDashboard
            selectedRestaurants={selectedRestaurants}
            selectedYear={selectedYear}
            selectedMonth={periodMode === "year" ? "all" : selectedMonth}
            restaurants={restaurants || []}
          />
        </TabsContent>

        <TabsContent value="availability" className="mt-6 space-y-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
