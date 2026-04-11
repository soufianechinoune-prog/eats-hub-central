import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Clock, AlertTriangle, TrendingDown, LineChart as LineChartIcon, BarChart3, ChevronLeft, ChevronRight, Timer, Ban, Target, CheckCircle2, Building2 } from "lucide-react";
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
  ReferenceLine,
  LabelList,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface WaitTimeDailyRow {
  restaurant_id: string;
  day: string;
  hour: number | null;
  avg_avoidable_wait: number | null;
  avg_courier_wait: number | null;
  orders_with_avoidable: number;
  orders_with_courier_wait: number;
  total_orders: number;
}

export function WaitTimeAnalytics() {
  const {
    selectedRestaurants,
    selectedPlatform,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange: contextDateRange,
    setPeriodMode,
    setSelectedMonth,
  } = useAnalyticsContext();

  const [chartType, setChartType] = useState<"line" | "bar">("bar");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [targetMinutes, setTargetMinutes] = useState<number>(5);

  const dateRange = useMemo(() => {
    if ((periodMode === "range" || periodMode === "7d" || periodMode === "30d" || periodMode === "previous_week") && contextDateRange?.from && contextDateRange?.to) {
      return { start: contextDateRange.from, end: contextDateRange.to };
    }
    if (periodMode === "month" || periodMode === "current_month") {
      const start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      const end = endOfMonth(new Date(selectedYear, selectedMonth - 1));
      return { start, end };
    }
    const start = new Date(selectedYear, 0, 1);
    const end = new Date(selectedYear, 11, 31);
    return { start, end };
  }, [selectedYear, selectedMonth, periodMode, contextDateRange]);

  const platformParam = selectedPlatform === "uber_eats" || selectedPlatform === "deliveroo" ? selectedPlatform : null;

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants_for_wait_time"],
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurants").select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const effectiveRestaurantIds = useMemo(
    () => (selectedRestaurants.length > 0 ? selectedRestaurants : (restaurants || []).map((r) => r.id)),
    [selectedRestaurants, restaurants]
  );

  const effectiveRestaurantsKey = JSON.stringify(effectiveRestaurantIds.slice().sort());

  const { data: dailyRows = [], isLoading } = useQuery({
    queryKey: ["wait_time_daily_rpc", effectiveRestaurantsKey, selectedPlatform, format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      if (effectiveRestaurantIds.length === 0) return [];
      const { data, error } = await supabase.rpc("get_wait_time_daily", {
        p_restaurant_ids: effectiveRestaurantIds,
        p_start_date: format(dateRange.start, "yyyy-MM-dd"),
        p_end_date: format(dateRange.end, "yyyy-MM-dd"),
        p_platform: platformParam,
        p_mode: "daily",
      } as any);
      if (error) throw error;
      return (data || []) as WaitTimeDailyRow[];
    },
    enabled: effectiveRestaurantIds.length > 0,
  });

  const { data: hourlyRows = [] } = useQuery({
    queryKey: ["wait_time_hourly_rpc", effectiveRestaurantsKey, selectedPlatform, format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      if (effectiveRestaurantIds.length === 0) return [];
      const { data, error } = await supabase.rpc("get_wait_time_daily", {
        p_restaurant_ids: effectiveRestaurantIds,
        p_start_date: format(dateRange.start, "yyyy-MM-dd"),
        p_end_date: format(dateRange.end, "yyyy-MM-dd"),
        p_platform: platformParam,
        p_mode: "hourly",
      } as any);
      if (error) throw error;
      return (data || []) as WaitTimeDailyRow[];
    },
    enabled: effectiveRestaurantIds.length > 0,
  });

  const restaurantMap = useMemo(() => {
    const map = new Map<string, string>();
    restaurants?.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [restaurants]);

  const kpis = useMemo(() => {
    if (!dailyRows.length) {
      return { avgAvoidableWait: 0, ordersWithAvoidableWait: 0, percentWithAvoidableWait: 0, avgTotalWait: 0, nonDeliveredOrders: 0, totalOrders: 0, ordersUnderTarget: 0, percentUnderTarget: 0 };
    }

    const totalOrders = dailyRows.reduce((s, r) => s + r.total_orders, 0);
    const totalWithAvoidable = dailyRows.reduce((s, r) => s + r.orders_with_avoidable, 0);
    const totalWithCourier = dailyRows.reduce((s, r) => s + r.orders_with_courier_wait, 0);

    const weightedAvoidable = dailyRows.reduce((s, r) => s + (r.avg_avoidable_wait || 0) * r.orders_with_avoidable, 0);
    const avgAvoidableWait = totalWithAvoidable > 0 ? weightedAvoidable / totalWithAvoidable : 0;

    const weightedCourier = dailyRows.reduce((s, r) => s + (r.avg_courier_wait || 0) * r.orders_with_courier_wait, 0);
    const avgTotalWait = totalWithCourier > 0 ? weightedCourier / totalWithCourier : 0;

    // Approximate: days where avg avoidable wait is under target → count all orders for that day
    const ordersUnderTarget = dailyRows
      .filter(r => r.avg_avoidable_wait === null || r.avg_avoidable_wait <= targetMinutes)
      .reduce((s, r) => s + r.total_orders, 0);

    return {
      avgAvoidableWait,
      ordersWithAvoidableWait: totalWithAvoidable,
      percentWithAvoidableWait: totalOrders > 0 ? (totalWithAvoidable / totalOrders) * 100 : 0,
      avgTotalWait,
      nonDeliveredOrders: 0,
      totalOrders,
      ordersUnderTarget,
      percentUnderTarget: totalOrders > 0 ? (ordersUnderTarget / totalOrders) * 100 : 0,
    };
  }, [dailyRows, targetMinutes]);

  const lastAvailableDate = useMemo(() => {
    if (!dailyRows.length) return null;
    const maxDay = dailyRows.reduce((max, r) => (String(r.day) > max ? String(r.day) : max), "");
    return maxDay ? parseISO(maxDay) : null;
  }, [dailyRows]);

  const monthlyEvolution = useMemo(() => {
    const lastMonth = lastAvailableDate && periodMode === "year" ? lastAvailableDate.getMonth() + 1 : 12;
    const allMonths = Array.from({ length: lastMonth }, (_, i) => ({
      monthKey: `${selectedYear}-${String(i + 1).padStart(2, '0')}`,
      displayDate: format(new Date(selectedYear, i, 1), "MMM", { locale: fr }),
      avgAvoidableWait: null as number | null,
      percentWithAvoidable: null as number | null,
      monthIndex: i + 1,
      year: selectedYear,
    }));

    if (!dailyRows.length) return allMonths;

    const monthlyMap = new Map<string, { totalWithAvoidable: number; weightedSum: number; totalOrders: number }>();
    dailyRows.forEach((r) => {
      const monthKey = String(r.day).substring(0, 7);
      const existing = monthlyMap.get(monthKey) || { totalWithAvoidable: 0, weightedSum: 0, totalOrders: 0 };
      existing.totalOrders += r.total_orders;
      existing.totalWithAvoidable += r.orders_with_avoidable;
      existing.weightedSum += (r.avg_avoidable_wait || 0) * r.orders_with_avoidable;
      monthlyMap.set(monthKey, existing);
    });

    return allMonths.map((month) => {
      const data = monthlyMap.get(month.monthKey);
      if (data && data.totalOrders > 0) {
        return {
          ...month,
          avgAvoidableWait: data.totalWithAvoidable > 0 ? data.weightedSum / data.totalWithAvoidable : 0,
          percentWithAvoidable: (data.totalWithAvoidable / data.totalOrders) * 100,
        };
      }
      return month;
    });
  }, [dailyRows, selectedYear, lastAvailableDate, periodMode]);

  const dailyEvolution = useMemo(() => {
    if (!dailyRows.length) return [];

    const dayMap = new Map<string, { totalWithAvoidable: number; weightedSum: number; totalOrders: number }>();
    dailyRows.forEach((r) => {
      const day = String(r.day);
      const existing = dayMap.get(day) || { totalWithAvoidable: 0, weightedSum: 0, totalOrders: 0 };
      existing.totalOrders += r.total_orders;
      existing.totalWithAvoidable += r.orders_with_avoidable;
      existing.weightedSum += (r.avg_avoidable_wait || 0) * r.orders_with_avoidable;
      dayMap.set(day, existing);
    });

    return Array.from(dayMap.entries())
      .map(([date, values]) => ({
        date,
        displayDate: format(parseISO(date), "d", { locale: fr }),
        avgAvoidableWait: values.totalWithAvoidable > 0 ? values.weightedSum / values.totalWithAvoidable : 0,
        percentWithAvoidable: values.totalOrders > 0 ? (values.totalWithAvoidable / values.totalOrders) * 100 : 0,
        ordersWithAvoidable: values.totalWithAvoidable,
        totalOrders: values.totalOrders,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyRows]);

  const hourlyEvolution = useMemo(() => {
    if (!selectedDay || !hourlyRows.length) return [];

    const dayHourlyData = hourlyRows.filter((r) => String(r.day) === selectedDay);

    return Array.from({ length: 24 }, (_, hour) => {
      const hourData = dayHourlyData.filter((r) => r.hour === hour);
      const totalWithAvoidable = hourData.reduce((s, r) => s + r.orders_with_avoidable, 0);
      const weightedSum = hourData.reduce((s, r) => s + (r.avg_avoidable_wait || 0) * r.orders_with_avoidable, 0);
      const totalOrders = hourData.reduce((s, r) => s + r.total_orders, 0);

      return {
        hour: `${hour}h`,
        hourIndex: hour,
        avgAvoidableWait: totalWithAvoidable > 0 ? weightedSum / totalWithAvoidable : null,
        percentWithAvoidable: totalOrders > 0 ? (totalWithAvoidable / totalOrders) * 100 : null,
        ordersWithAvoidable: totalWithAvoidable,
        totalOrders,
      };
    });
  }, [hourlyRows, selectedDay]);

  const hourlyHeatmap = useMemo(() => {
    if (!hourlyRows.length) return [];

    const heatmap: Record<string, { weightedSum: number; totalWithAvoidable: number }> = {};

    hourlyRows.forEach((r) => {
      const dateObj = parseISO(String(r.day));
      const dayOfWeek = dateObj.getDay();
      const key = `${dayOfWeek}-${r.hour}`;

      if (!heatmap[key]) {
        heatmap[key] = { weightedSum: 0, totalWithAvoidable: 0 };
      }
      heatmap[key].weightedSum += (r.avg_avoidable_wait || 0) * r.orders_with_avoidable;
      heatmap[key].totalWithAvoidable += r.orders_with_avoidable;
    });

    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const result: { day: string; hour: number; avgWait: number; dayIndex: number }[] = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        const data = heatmap[key];
        result.push({
          day: days[day],
          hour,
          avgWait: data && data.totalWithAvoidable > 0 ? data.weightedSum / data.totalWithAvoidable : 0,
          dayIndex: day,
        });
      }
    }

    return result;
  }, [hourlyRows]);

  const restaurantRanking = useMemo(() => {
    if (!dailyRows.length) return [];

    const restaurantStats = new Map<string, { weightedSum: number; totalWithAvoidable: number; totalOrders: number }>();

    dailyRows.forEach((r) => {
      const existing = restaurantStats.get(r.restaurant_id) || { weightedSum: 0, totalWithAvoidable: 0, totalOrders: 0 };
      existing.totalOrders += r.total_orders;
      existing.totalWithAvoidable += r.orders_with_avoidable;
      existing.weightedSum += (r.avg_avoidable_wait || 0) * r.orders_with_avoidable;
      restaurantStats.set(r.restaurant_id, existing);
    });

    return Array.from(restaurantStats.entries())
      .map(([id, stats]) => ({
        id,
        name: restaurantMap.get(id) || id.slice(0, 8),
        avgAvoidableWait: stats.totalWithAvoidable > 0 ? stats.weightedSum / stats.totalWithAvoidable : 0,
        percentWithAvoidable: stats.totalOrders > 0 ? (stats.totalWithAvoidable / stats.totalOrders) * 100 : 0,
        totalOrders: stats.totalOrders,
      }))
      .sort((a, b) => b.avgAvoidableWait - a.avgAvoidableWait);
  }, [dailyRows, restaurantMap]);

  const topFlop = useMemo(() => {
    const sorted = [...restaurantRanking].sort((a, b) => a.avgAvoidableWait - b.avgAvoidableWait);
    return {
      top5: sorted.slice(0, 5),
      flop5: sorted.slice(-5).reverse(),
    };
  }, [restaurantRanking]);

  const isRangeMode = periodMode === "range" || periodMode === "7d" || periodMode === "30d" || periodMode === "previous_week";
  const chartData = selectedDay
    ? hourlyEvolution
    : (periodMode === "month" || periodMode === "current_month" || isRangeMode)
      ? dailyEvolution
      : monthlyEvolution;

  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      const payload = data.activePayload[0].payload;
      if (periodMode === "year" && payload.monthIndex) {
        setPeriodMode("month");
        setSelectedMonth(payload.monthIndex);
        setSelectedDay(null);
      } else if (periodMode === "month" && payload.date && !selectedDay) {
        setSelectedDay(payload.date);
      }
    }
  };

  const handlePrevMonth = () => setSelectedMonth(selectedMonth === 1 ? 12 : selectedMonth - 1);
  const handleNextMonth = () => {
    if (lastAvailableDate && selectedMonth >= lastAvailableDate.getMonth() + 1 && selectedYear >= lastAvailableDate.getFullYear()) return;
    setSelectedMonth(selectedMonth === 12 ? 1 : selectedMonth + 1);
  };
  const handleBackToYear = () => { setPeriodMode("year"); setSelectedDay(null); };
  const handleBackToMonth = () => setSelectedDay(null);
  const handlePrevDay = () => selectedDay && setSelectedDay(format(subDays(parseISO(selectedDay), 1), "yyyy-MM-dd"));
  const handleNextDay = () => {
    if (!selectedDay) return;
    const nextDay = addDays(parseISO(selectedDay), 1);
    if (lastAvailableDate && nextDay > lastAvailableDate) return;
    setSelectedDay(format(nextDay, "yyyy-MM-dd"));
  };

  const getChartTitle = () => {
    if (selectedDay) return format(parseISO(selectedDay), "EEEE d MMMM yyyy", { locale: fr });
    if (periodMode === "month") return format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", { locale: fr });
    return "Évolution du temps d'attente évitable";
  };

  const isChartClickable = () => !selectedDay;
  const getXAxisDataKey = () => selectedDay ? "hour" : "displayDate";

  const formatMinutes = (mins: number) => {
    if (mins < 1) return `${Math.round(mins * 60)}s`;
    if (mins < 60) return `${mins.toFixed(1)}min`;
    return `${Math.floor(mins / 60)}h${Math.round(mins % 60)}min`;
  };

  const getWaitColor = (mins: number) => {
    if (mins <= 1) return "hsl(var(--chart-2))";
    if (mins <= 3) return "hsl(var(--chart-4))";
    return "hsl(var(--destructive))";
  };

  const getBarColor = (value: number | null) => {
    if (value === null || value === 0) return "hsl(142, 76%, 36%)";
    if (value <= targetMinutes) return "hsl(142, 76%, 36%)";
    return "hsl(0, 84%, 50%)";
  };

  const getHeatmapColor = (waitMins: number) => {
    if (waitMins === 0) return "hsl(var(--chart-2) / 0.3)";
    if (waitMins < 1) return "hsl(var(--chart-4) / 0.5)";
    if (waitMins < 2) return "hsl(var(--chart-4))";
    if (waitMins < 3) return "hsl(var(--destructive) / 0.7)";
    return "hsl(var(--destructive))";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dailyRows || dailyRows.length === 0) {
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
          Aucune donnée d'historique de commandes pour cette période.
        </p>
        <p className="text-sm text-muted-foreground">
          Importez un fichier "Historique des commandes" depuis la page Import Rapports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Temps évitable moyen
            </CardTitle>
            <Timer className="h-5 w-5 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: getWaitColor(kpis.avgAvoidableWait) }}>
              {formatMinutes(kpis.avgAvoidableWait)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Par commande avec attente
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commandes avec temps évitable
            </CardTitle>
            <Clock className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {kpis.ordersWithAvoidableWait.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.percentWithAvoidableWait.toFixed(1)}% des commandes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Temps d'attente total moyen
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {formatMinutes(kpis.avgTotalWait)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Temps coursier total
            </p>
          </CardContent>
        </Card>

        {/* Objective KPI */}
        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Objectif atteint (≤ {targetMinutes} min)
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-2">
              {kpis.percentUnderTarget.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.ordersUnderTarget.toLocaleString()} / {kpis.totalOrders.toLocaleString()} commandes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commandes non livrées
            </CardTitle>
            <Ban className="h-5 w-5 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-4">
              {kpis.nonDeliveredOrders.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sur {kpis.totalOrders.toLocaleString()} commandes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Chart */}
      <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            {selectedDay ? (
              <Button variant="ghost" size="sm" onClick={handleBackToMonth} className="h-8 px-2">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Retour au mois
              </Button>
            ) : periodMode === "month" ? (
              <Button variant="ghost" size="sm" onClick={handleBackToYear} className="h-8 px-2">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
            ) : null}

            <CardTitle className="capitalize">{getChartTitle()}</CardTitle>

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
          <div className="flex items-center gap-4">
            {/* Objective Slider */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">Objectif:</span>
              <Slider
                value={[targetMinutes]}
                onValueChange={([val]) => setTargetMinutes(val)}
                min={0}
                max={10}
                step={0.5}
                className="w-28"
              />
              <span className="text-sm font-semibold text-primary min-w-[3rem]">{targetMinutes} min</span>
            </div>

            {/* Chart type toggle */}
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
          </div>
        </CardHeader>
        <CardContent className="w-full">
          <ChartContainer
            config={{
              avgAvoidableWait: { label: "Temps évitable (min)", color: "hsl(var(--chart-4))" },
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
                  <ReferenceArea y1={0} y2={targetMinutes} fill="hsl(142, 76%, 36%)" fillOpacity={0.1} />
                  <ReferenceArea y1={targetMinutes} y2={15} fill="hsl(0, 84%, 50%)" fillOpacity={0.05} />
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey={getXAxisDataKey()} className="text-xs" tick={{ fontSize: 11 }} interval={selectedDay ? 1 : 0} />
                  <YAxis className="text-xs" tickFormatter={(v) => `${v}min`} width={50} domain={[0, 'auto']} />
                  <ReferenceLine
                    y={targetMinutes}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    label={{
                      value: `Objectif: ${targetMinutes} min`,
                      position: "insideTopRight",
                      fill: "hsl(var(--primary))",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, props) => {
                          if (value === null) return ["Pas de données", ""];
                          const numValue = Number(value);
                          const status = numValue <= targetMinutes ? "✓ Objectif atteint" : "✗ Au-dessus objectif";
                          return [`${numValue.toFixed(1)} min - ${status}`, "Temps évitable"];
                        }}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="avgAvoidableWait"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--chart-4))", cursor: isChartClickable() ? "pointer" : "default" }}
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
                  <ReferenceArea y1={0} y2={targetMinutes} fill="hsl(142, 76%, 36%)" fillOpacity={0.08} />
                  <ReferenceArea y1={targetMinutes} y2={15} fill="hsl(0, 84%, 50%)" fillOpacity={0.03} />
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey={getXAxisDataKey()} className="text-xs" tick={{ fontSize: 11 }} interval={selectedDay ? 1 : 0} />
                  <YAxis className="text-xs" tickFormatter={(v) => `${v}min`} width={50} domain={[0, 'auto']} />
                  <ReferenceLine
                    y={targetMinutes}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    label={{
                      value: `Objectif: ${targetMinutes} min`,
                      position: "insideTopRight",
                      fill: "hsl(var(--primary))",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, props) => {
                          if (value === null) return ["Pas de données", ""];
                          const entry = props.payload;
                          const numValue = Number(value);
                          const status = numValue <= targetMinutes ? "✓" : "✗";
                          return [
                            `${numValue.toFixed(1)} min ${status}${entry?.ordersWithAvoidable ? ` (${entry.ordersWithAvoidable} cmd)` : ''}`,
                            "Temps évitable"
                          ];
                        }}
                      />
                    }
                  />
                  <Bar dataKey="avgAvoidableWait" radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={1}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.avgAvoidableWait === null ? "transparent" : getBarColor(entry.avgAvoidableWait)}
                        stroke={entry.avgAvoidableWait === null ? "transparent" : "#fff"}
                      />
                    ))}
                    <LabelList
                      dataKey="avgAvoidableWait"
                      position="top"
                      formatter={(value: number | null) =>
                        value !== null && value > 0 ? `${value.toFixed(1)}` : ""
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Heatmap */}
        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Heatmap temps d'attente évitable (moyenne en min)</CardTitle>
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
                const adjustedDayIdx = dayIdx === 6 ? 0 : dayIdx + 1;
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
                          style={{ backgroundColor: getHeatmapColor(data?.avgWait || 0) }}
                          title={`${day} ${hour}h: ${(data?.avgWait || 0).toFixed(1)} min`}
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
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(1.5) }} />
                  1-2 min
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(4) }} />
                  &gt;3 min
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restaurant Ranking */}
        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Classement par temps d'attente évitable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topFlop.flop5.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    À améliorer (plus longs)
                  </h4>
                  <div className="space-y-2">
                    {topFlop.flop5.map((r, idx) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 border border-destructive/20"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="text-sm font-medium truncate max-w-[200px]">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {r.percentWithAvoidable.toFixed(0)}% cmd
                          </span>
                          <span
                            className="text-sm font-bold"
                            style={{ color: getWaitColor(r.avgAvoidableWait) }}
                          >
                            {formatMinutes(r.avgAvoidableWait)}
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
                    <Clock className="h-4 w-4" />
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
                          <span className="text-sm font-medium truncate max-w-[200px]">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {r.percentWithAvoidable.toFixed(0)}% cmd
                          </span>
                          <span
                            className="text-sm font-bold"
                            style={{ color: getWaitColor(r.avgAvoidableWait) }}
                          >
                            {formatMinutes(r.avgAvoidableWait)}
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
    </div>
  );
}
