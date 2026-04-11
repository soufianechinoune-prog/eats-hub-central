import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Clock, AlertTriangle, TrendingDown, LineChart as LineChartIcon, BarChart3, ChevronLeft, ChevronRight, Timer, Target, CheckCircle2, Building2, ChefHat } from "lucide-react";
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

interface PrepTimeDailyRow {
  restaurant_id: string;
  day: string;
  hour: number | null;
  avg_prep_time: number;
  min_prep_time: number;
  max_prep_time: number;
  order_count: number;
}

export function PrepTimeAnalytics() {
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
  const [targetMinutes, setTargetMinutes] = useState<number>(6);

  // Calculate date range based on period mode
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

  const selectedRestaurantsKey = JSON.stringify(selectedRestaurants.slice().sort());

  const platformParam = selectedPlatform === "uber_eats" || selectedPlatform === "deliveroo" ? selectedPlatform : null;

  const { data: rpcData, isLoading } = useQuery({
    queryKey: ["prep_time_daily_rpc", selectedRestaurantsKey, selectedPlatform, format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      if (selectedRestaurants.length === 0) return [];
      const { data, error } = await supabase.rpc("get_prep_time_daily", {
        p_restaurant_ids: selectedRestaurants,
        p_start_date: format(dateRange.start, "yyyy-MM-dd"),
        p_end_date: format(dateRange.end, "yyyy-MM-dd"),
        p_platform: platformParam,
      });
      if (error) throw error;
      return (data || []) as PrepTimeDailyRow[];
    },
  });

  // Split RPC data into daily rows (hour IS NULL) and hourly rows
  const dailyRows = useMemo(() => (rpcData || []).filter(r => r.hour === null), [rpcData]);
  const hourlyRows = useMemo(() => (rpcData || []).filter(r => r.hour !== null), [rpcData]);

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants_for_prep_time"],
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
    if (!orderHistoryData || orderHistoryData.length === 0) {
      return {
        avgPrepTime: 0,
        totalOrders: 0,
        ordersUnderTarget: 0,
        percentUnderTarget: 0,
        minPrepTime: 0,
        maxPrepTime: 0,
      };
    }

    const prepTimes = orderHistoryData
      .map((o) => o.initial_prep_time_minutes)
      .filter((t): t is number => t !== null);

    const avgPrepTime = prepTimes.length > 0
      ? prepTimes.reduce((sum, t) => sum + t, 0) / prepTimes.length
      : 0;

    const ordersUnderTarget = prepTimes.filter((t) => t <= targetMinutes).length;

    return {
      avgPrepTime,
      totalOrders: orderHistoryData.length,
      ordersUnderTarget,
      percentUnderTarget: prepTimes.length > 0 ? (ordersUnderTarget / prepTimes.length) * 100 : 0,
      minPrepTime: prepTimes.length > 0 ? Math.min(...prepTimes) : 0,
      maxPrepTime: prepTimes.length > 0 ? Math.max(...prepTimes) : 0,
    };
  }, [orderHistoryData, targetMinutes]);

  // Monthly evolution for year view
  const monthlyEvolution = useMemo(() => {
    const allMonths = Array.from({ length: 12 }, (_, i) => ({
      monthKey: `${selectedYear}-${String(i + 1).padStart(2, '0')}`,
      displayDate: format(new Date(selectedYear, i, 1), "MMM", { locale: fr }),
      avgPrepTime: null as number | null,
      orderCount: 0,
      monthIndex: i + 1,
      year: selectedYear,
    }));

    if (!orderHistoryData || orderHistoryData.length === 0) return allMonths;

    const monthlyMap = new Map<string, { total: number; sum: number }>();

    orderHistoryData.forEach((o) => {
      if (!o.order_datetime || o.initial_prep_time_minutes === null) return;
      const dateStr = o.order_datetime.split('T')[0] || o.order_datetime.substring(0, 10);
      const monthKey = dateStr.substring(0, 7);
      const existing = monthlyMap.get(monthKey) || { total: 0, sum: 0 };
      existing.total++;
      existing.sum += o.initial_prep_time_minutes;
      monthlyMap.set(monthKey, existing);
    });

    return allMonths.map((month) => {
      const data = monthlyMap.get(month.monthKey);
      if (data && data.total > 0) {
        return {
          ...month,
          avgPrepTime: data.sum / data.total,
          orderCount: data.total,
        };
      }
      return month;
    });
  }, [orderHistoryData, selectedYear]);

  // Daily evolution for month view
  const dailyEvolution = useMemo(() => {
    if (!orderHistoryData || orderHistoryData.length === 0) return [];

    const dailyMap = new Map<string, { total: number; sum: number }>();

    orderHistoryData.forEach((o) => {
      if (!o.order_datetime || o.initial_prep_time_minutes === null) return;
      const date = format(parseISO(o.order_datetime), "yyyy-MM-dd");
      const existing = dailyMap.get(date) || { total: 0, sum: 0 };
      existing.total++;
      existing.sum += o.initial_prep_time_minutes;
      dailyMap.set(date, existing);
    });

    return Array.from(dailyMap.entries())
      .map(([date, values]) => ({
        date,
        displayDate: format(parseISO(date), "d", { locale: fr }),
        avgPrepTime: values.total > 0 ? values.sum / values.total : 0,
        orderCount: values.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [orderHistoryData]);

  // Hourly evolution for day view
  const hourlyEvolution = useMemo(() => {
    if (!selectedDay || !orderHistoryData) return [];

    const dayData = orderHistoryData.filter((o) =>
      o.order_datetime && o.order_datetime.startsWith(selectedDay)
    );

    return Array.from({ length: 24 }, (_, hour) => {
      const hourStr = String(hour).padStart(2, "0");
      const hourData = dayData.filter((o) => {
        if (!o.order_datetime) return false;
        const hourPart = o.order_datetime.substring(11, 13);
        return hourPart === hourStr;
      });

      const prepTimes = hourData
        .map((o) => o.initial_prep_time_minutes)
        .filter((t): t is number => t !== null);

      return {
        hour: `${hour}h`,
        hourIndex: hour,
        avgPrepTime: prepTimes.length > 0 ? prepTimes.reduce((s, t) => s + t, 0) / prepTimes.length : null,
        orderCount: hourData.length,
      };
    });
  }, [orderHistoryData, selectedDay]);

  // Hourly heatmap (hour x day of week)
  const hourlyHeatmap = useMemo(() => {
    if (!orderHistoryData || orderHistoryData.length === 0) return [];

    const heatmap: Record<string, { sum: number; count: number }> = {};

    orderHistoryData.forEach((o) => {
      if (!o.order_datetime || o.initial_prep_time_minutes === null) return;
      const dateObj = parseISO(o.order_datetime);
      const hour = dateObj.getHours();
      const dayOfWeek = dateObj.getDay();
      const key = `${dayOfWeek}-${hour}`;

      if (!heatmap[key]) {
        heatmap[key] = { sum: 0, count: 0 };
      }
      heatmap[key].sum += o.initial_prep_time_minutes;
      heatmap[key].count++;
    });

    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const result: { day: string; hour: number; avgPrepTime: number; dayIndex: number }[] = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        const data = heatmap[key];
        result.push({
          day: days[day],
          hour,
          avgPrepTime: data && data.count > 0 ? data.sum / data.count : 0,
          dayIndex: day,
        });
      }
    }

    return result;
  }, [orderHistoryData]);

  // Restaurant ranking by prep time
  const restaurantRanking = useMemo(() => {
    if (!orderHistoryData || orderHistoryData.length === 0) return [];

    const restaurantStats = new Map<string, { sum: number; count: number }>();

    orderHistoryData.forEach((o) => {
      if (o.initial_prep_time_minutes === null) return;
      const existing = restaurantStats.get(o.restaurant_id) || { sum: 0, count: 0 };
      existing.sum += o.initial_prep_time_minutes;
      existing.count++;
      restaurantStats.set(o.restaurant_id, existing);
    });

    return Array.from(restaurantStats.entries())
      .map(([id, stats]) => ({
        id,
        name: restaurantMap.get(id) || id.slice(0, 8),
        avgPrepTime: stats.count > 0 ? stats.sum / stats.count : 0,
        totalOrders: stats.count,
      }))
      .sort((a, b) => a.avgPrepTime - b.avgPrepTime); // Fastest first
  }, [orderHistoryData, restaurantMap]);

  const topFlop = useMemo(() => {
    return {
      top5: restaurantRanking.slice(0, 5),
      flop5: restaurantRanking.slice(-5).reverse(),
    };
  }, [restaurantRanking]);

  // Select data based on current view
  const isRangeMode = periodMode === "range" || periodMode === "7d" || periodMode === "30d" || periodMode === "previous_week";
  const chartData = selectedDay
    ? hourlyEvolution
    : (periodMode === "month" || periodMode === "current_month" || isRangeMode)
      ? dailyEvolution
      : monthlyEvolution;

  // Navigation handlers
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
  const handleNextMonth = () => setSelectedMonth(selectedMonth === 12 ? 1 : selectedMonth + 1);
  const handleBackToYear = () => { setPeriodMode("year"); setSelectedDay(null); };
  const handleBackToMonth = () => setSelectedDay(null);
  const handlePrevDay = () => selectedDay && setSelectedDay(format(subDays(parseISO(selectedDay), 1), "yyyy-MM-dd"));
  const handleNextDay = () => selectedDay && setSelectedDay(format(addDays(parseISO(selectedDay), 1), "yyyy-MM-dd"));

  const getChartTitle = () => {
    if (selectedDay) {
      return format(parseISO(selectedDay), "EEEE d MMMM yyyy", { locale: fr });
    }
    if (periodMode === "month") {
      return format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", { locale: fr });
    }
    return "Évolution du temps de préparation";
  };

  const isChartClickable = () => !selectedDay;
  const getXAxisDataKey = () => selectedDay ? "hour" : "displayDate";

  const formatMinutes = (mins: number) => {
    if (mins < 1) return `${Math.round(mins * 60)}s`;
    const m = Math.floor(mins);
    const s = Math.round((mins - m) * 60);
    if (s === 0) return `${m}min`;
    return `${m}min ${s}s`;
  };

  const getPrepColor = (mins: number) => {
    if (mins <= 4) return "hsl(var(--chart-2))"; // Green - Excellent
    if (mins <= 6) return "hsl(var(--chart-4))"; // Amber - OK
    return "hsl(var(--destructive))"; // Red - Slow
  };

  const getBarColor = (value: number | null) => {
    if (value === null || value === 0) return "hsl(142, 76%, 36%)";
    if (value <= 4) return "hsl(142, 76%, 36%)"; // Green - Excellent
    if (value <= targetMinutes) return "hsl(38, 92%, 50%)"; // Amber - Under target
    return "hsl(0, 84%, 50%)"; // Red - Over target
  };

  const getHeatmapColor = (prepMins: number) => {
    if (prepMins === 0) return "hsl(var(--chart-2) / 0.3)";
    if (prepMins <= 4) return "hsl(var(--chart-2) / 0.6)";
    if (prepMins <= 6) return "hsl(var(--chart-4) / 0.7)";
    if (prepMins <= 8) return "hsl(var(--destructive) / 0.5)";
    return "hsl(var(--destructive))";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!orderHistoryData || orderHistoryData.length === 0) {
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
          Aucune donnée de temps de préparation pour cette période.
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Temps de préparation moyen
            </CardTitle>
            <ChefHat className="h-5 w-5 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: getPrepColor(kpis.avgPrepTime) }}>
              {formatMinutes(kpis.avgPrepTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Par commande
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commandes analysées
            </CardTitle>
            <Clock className="h-5 w-5 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {kpis.totalOrders.toLocaleString('fr-FR')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sur la période sélectionnée
            </p>
          </CardContent>
        </Card>

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
              {kpis.ordersUnderTarget.toLocaleString('fr-FR')} / {kpis.totalOrders.toLocaleString('fr-FR')} commandes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Amplitude
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {formatMinutes(kpis.minPrepTime)} - {formatMinutes(kpis.maxPrepTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Min - Max sur la période
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
                min={2}
                max={12}
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
              avgPrepTime: { label: "Temps de prépa (min)", color: "hsl(var(--chart-4))" },
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
                  <ReferenceArea y1={0} y2={4} fill="hsl(142, 76%, 36%)" fillOpacity={0.1} />
                  <ReferenceArea y1={4} y2={targetMinutes} fill="hsl(38, 92%, 50%)" fillOpacity={0.05} />
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
                          const numValue = Number(value);
                          const status = numValue <= targetMinutes ? "✓ Objectif atteint" : "✗ Au-dessus objectif";
                          return [`${formatMinutes(numValue)} - ${status}`, "Temps de prépa"];
                        }}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="avgPrepTime"
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
                  <ReferenceArea y1={0} y2={4} fill="hsl(142, 76%, 36%)" fillOpacity={0.08} />
                  <ReferenceArea y1={4} y2={targetMinutes} fill="hsl(38, 92%, 50%)" fillOpacity={0.05} />
                  <ReferenceArea y1={targetMinutes} y2={15} fill="hsl(0, 84%, 50%)" fillOpacity={0.02} />
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
                            `${formatMinutes(numValue)} ${status}${entry?.orderCount ? ` (${entry.orderCount} cmd)` : ''}`,
                            "Temps de prépa"
                          ];
                        }}
                      />
                    }
                  />
                  <Bar dataKey="avgPrepTime" radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={1}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.avgPrepTime === null ? "transparent" : getBarColor(entry.avgPrepTime)}
                        stroke={entry.avgPrepTime === null ? "transparent" : "#fff"}
                      />
                    ))}
                    <LabelList
                      dataKey="avgPrepTime"
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
            <CardTitle>Heatmap temps de préparation (moyenne en min)</CardTitle>
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
                          style={{ backgroundColor: getHeatmapColor(data?.avgPrepTime || 0) }}
                          title={`${day} ${hour}h: ${formatMinutes(data?.avgPrepTime || 0)}`}
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
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(4) }} />
                  ≤4 min
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(6) }} />
                  4-6 min
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(8) }} />
                  6-8 min
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(10) }} />
                  &gt;8 min
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restaurant Ranking */}
        <Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Classement par rapidité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Top performers (fastest) */}
              <div>
                <h4 className="text-sm font-semibold text-chart-2 mb-3 flex items-center gap-1">
                  🏆 Les plus rapides
                </h4>
                <div className="space-y-2">
                  {topFlop.top5.map((r, i) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="font-medium truncate max-w-[120px]">{r.name}</span>
                      </span>
                      <span className="text-chart-2 font-semibold tabular-nums">
                        {formatMinutes(r.avgPrepTime)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom performers (slowest) */}
              <div>
                <h4 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-1">
                  ⚠️ À améliorer
                </h4>
                <div className="space-y-2">
                  {topFlop.flop5.map((r, i) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{restaurantRanking.length - 4 + i}.</span>
                        <span className="font-medium truncate max-w-[120px]">{r.name}</span>
                      </span>
                      <span className="text-destructive font-semibold tabular-nums">
                        {formatMinutes(r.avgPrepTime)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
