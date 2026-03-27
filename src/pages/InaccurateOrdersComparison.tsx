import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePinnedRestaurants, useActiveRestaurants } from "@/hooks/useChainRestaurants";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InaccurateOrdersRankingBars } from "@/components/compare/InaccurateOrdersRankingBars";
import { InaccurateOrdersInsightsSection } from "@/components/compare/InaccurateOrdersInsightsSection";
import { InaccurateOrdersHeatmapGrid } from "@/components/compare/InaccurateOrdersHeatmapGrid";
import { NetworkViewToggle } from "@/components/compare/NetworkViewToggle";
import { filterActiveRestaurants } from "@/lib/restaurantActivityFilter";

type PeriodType = "week" | "month" | "quarter";

const InaccurateOrdersComparison = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodType>("week");
  const [isNetworkView, setIsNetworkView] = useState(false);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "week": {
        const lastWeekEnd = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
        const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
        return { start: lastWeekStart, end: lastWeekEnd };
      }
      case "month": {
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case "quarter":
        return { start: subMonths(now, 3), end: now };
      default:
        return { start: subDays(now, 7), end: now };
    }
  }, [period]);

  // Fetch pinned restaurants with activity dates
  const { data: pinnedRestaurantsRaw } = usePinnedRestaurants();
  const { data: allActiveRestaurantsRaw } = useActiveRestaurants();

  const pinnedRestaurants = useMemo(() => {
    if (!pinnedRestaurantsRaw) return [];
    return filterActiveRestaurants(pinnedRestaurantsRaw, dateRange.start, dateRange.end);
  }, [pinnedRestaurantsRaw, dateRange.start, dateRange.end]);

  const allActiveRestaurants = useMemo(() => {
    if (!allActiveRestaurantsRaw) return [];
    return filterActiveRestaurants(allActiveRestaurantsRaw, dateRange.start, dateRange.end);
  }, [allActiveRestaurantsRaw, dateRange.start, dateRange.end]);

  const selectedRestaurants = isNetworkView ? allActiveRestaurants : pinnedRestaurants;

  // Fetch order errors from order_errors table
  const { data: orderErrorsData, isLoading: errorsLoading } = useQuery({
    queryKey: ["inaccurate-orders-comparison-errors", selectedRestaurants?.map(r => r.id), dateRange.start, dateRange.end, isNetworkView],
    queryFn: async () => {
      if (!selectedRestaurants?.length) return [];

      const { data, error } = await supabase
        .from("order_errors")
        .select("restaurant_id, uber_order_id, financial_impact, error_date, error_category")
        .in("restaurant_id", selectedRestaurants.map(r => r.id))
        .gte("error_date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("error_date", format(dateRange.end, "yyyy-MM-dd"));

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRestaurants?.length,
  });

  // Fetch order counts from daily_sales_uber_deduped
  const { data: orderCountsData, isLoading: ordersLoading } = useQuery({
    queryKey: ["inaccurate-orders-comparison-sales", selectedRestaurants?.map(r => r.id), dateRange.start, dateRange.end, isNetworkView],
    queryFn: async () => {
      if (!selectedRestaurants?.length) return [];

      const { data, error } = await supabase
        .rpc("get_daily_revenue_from_orders", {
          p_start_date: format(dateRange.start, "yyyy-MM-dd"),
          p_end_date: format(dateRange.end, "yyyy-MM-dd"),
          p_restaurant_ids: selectedRestaurants.map(r => r.id),
        });

      if (error) throw error;
      return (data || []).map((d: any) => ({
        restaurant_id: d.restaurant_id,
        date: d.date,
        order_count: Number(d.order_count),
      }));
    },
    enabled: !!selectedRestaurants?.length,
  });

  const isLoading = errorsLoading || ordersLoading;

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!orderErrorsData || !selectedRestaurants?.length) return [];

    // Build order counts by restaurant and weekday
    const orderCountsByRestaurant: Record<string, { total: number; weekday: Record<number, number> }> = {};
    orderCountsData?.forEach((row) => {
      if (!orderCountsByRestaurant[row.restaurant_id]) {
        orderCountsByRestaurant[row.restaurant_id] = { total: 0, weekday: {} };
      }
      orderCountsByRestaurant[row.restaurant_id].total += row.order_count || 0;
      if (row.date) {
        const weekday = parseISO(row.date).getDay();
        orderCountsByRestaurant[row.restaurant_id].weekday[weekday] =
          (orderCountsByRestaurant[row.restaurant_id].weekday[weekday] || 0) + (row.order_count || 0);
      }
    });

    // Group order_errors by restaurant
    const errorsByRestaurant: Record<string, typeof orderErrorsData> = {};
    orderErrorsData.forEach((row) => {
      if (!errorsByRestaurant[row.restaurant_id]) {
        errorsByRestaurant[row.restaurant_id] = [];
      }
      errorsByRestaurant[row.restaurant_id].push(row);
    });

    const stats = selectedRestaurants.map((restaurant) => {
      const errors = errorsByRestaurant[restaurant.id] || [];
      const orderData = orderCountsByRestaurant[restaurant.id] || { total: 0, weekday: {} };

      // Count distinct orders with errors
      const distinctOrderIds = new Set(errors.map((e) => e.uber_order_id).filter(Boolean));
      const errorCount = distinctOrderIds.size;

      // Sum financial impact
      const totalFinancialImpact = errors.reduce((sum, e) => sum + (e.financial_impact || 0), 0);

      const orderCount = orderData.total;
      const errorRate = orderCount > 0 ? (errorCount / orderCount) * 100 : 0;

      // Group errors by day of week
      const weekdayData: Record<number, { errors: number; orders: number }> = {};
      for (let i = 0; i <= 6; i++) {
        weekdayData[i] = { errors: 0, orders: orderData.weekday[i] || 0 };
      }
      // Count distinct uber_order_ids per weekday
      const orderIdsByWeekday: Record<number, Set<string>> = {};
      for (let i = 0; i <= 6; i++) orderIdsByWeekday[i] = new Set();
      errors.forEach((e) => {
        if (!e.error_date || !e.uber_order_id) return;
        const weekday = parseISO(e.error_date).getDay();
        orderIdsByWeekday[weekday].add(e.uber_order_id);
      });
      for (let i = 0; i <= 6; i++) {
        weekdayData[i].errors = orderIdsByWeekday[i].size;
      }

      // Category breakdown from error_category
      const categoryCounts: Record<string, number> = {};
      errors.forEach((e) => {
        const cat = e.error_category || "Autre";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      return {
        id: restaurant.id,
        name: restaurant.name,
        errorRate,
        errorCount,
        orderCount,
        totalFinancialImpact,
        weekdayData,
        hourlyData: {} as Record<number, { errors: number; orders: number }>,
        errorTypes: categoryCounts,
      };
    });

    return stats.sort((a, b) => a.errorRate - b.errorRate);
  }, [orderErrorsData, orderCountsData, selectedRestaurants]);

  const periodLabel = useMemo(() => {
    return `${format(dateRange.start, "d MMM", { locale: fr })} - ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
  }, [dateRange]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-6 w-6 text-red-500" />
                <h1 className="text-2xl font-bold">Comparaison Commandes incorrectes</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Analyse de {restaurantStats.length} restaurants
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Calendar className="h-4 w-4" />
              <span>{periodLabel}</span>
            </div>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semaine précédente</SelectItem>
                <SelectItem value="month">Mois précédent</SelectItem>
                <SelectItem value="quarter">3 derniers mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid gap-6">
            <InaccurateOrdersInsightsSection stats={restaurantStats} period={period} />

            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Classement par taux d'erreur</CardTitle>
              </CardHeader>
              <CardContent>
                <InaccurateOrdersRankingBars stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Patterns d'erreurs</CardTitle>
              </CardHeader>
              <CardContent>
                <InaccurateOrdersHeatmapGrid stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default InaccurateOrdersComparison;
