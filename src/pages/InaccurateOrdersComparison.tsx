import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InaccurateOrdersRankingBars } from "@/components/compare/InaccurateOrdersRankingBars";
import { InaccurateOrdersInsightsSection } from "@/components/compare/InaccurateOrdersInsightsSection";
import { InaccurateOrdersHeatmapGrid } from "@/components/compare/InaccurateOrdersHeatmapGrid";

type PeriodType = "week" | "month" | "quarter";

const InaccurateOrdersComparison = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodType>("week");

  // Calculate date range based on period
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
      case "quarter": {
        return { start: subMonths(now, 3), end: now };
      }
      default:
        return { start: subDays(now, 7), end: now };
    }
  }, [period]);

  // Fetch pinned restaurants
  const { data: pinnedRestaurants } = useQuery({
    queryKey: ["pinned-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("is_pinned", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch order errors data
  const { data: orderErrorsData, isLoading: errorsLoading } = useQuery({
    queryKey: ["inaccurate-orders-comparison-errors", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const { data, error } = await supabase
        .from("order_errors")
        .select("restaurant_id, error_date, error_type, financial_impact")
        .in("restaurant_id", pinnedRestaurants.map(r => r.id))
        .gte("error_date", dateRange.start.toISOString())
        .lte("error_date", dateRange.end.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!pinnedRestaurants?.length,
  });

  // Fetch order history for total orders count
  const { data: orderHistoryData, isLoading: ordersLoading } = useQuery({
    queryKey: ["inaccurate-orders-comparison-orders", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const { data, error } = await supabase
        .from("order_history")
        .select("restaurant_id, order_datetime")
        .in("restaurant_id", pinnedRestaurants.map(r => r.id))
        .gte("order_datetime", dateRange.start.toISOString())
        .lte("order_datetime", dateRange.end.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!pinnedRestaurants?.length,
  });

  const isLoading = errorsLoading || ordersLoading;

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!orderErrorsData || !orderHistoryData || !pinnedRestaurants?.length) return [];
    
    const stats = pinnedRestaurants.map(restaurant => {
      const restaurantErrors = orderErrorsData.filter(d => d.restaurant_id === restaurant.id);
      const restaurantOrders = orderHistoryData.filter(d => d.restaurant_id === restaurant.id);
      
      // Calculate error rate
      const errorCount = restaurantErrors.length;
      const orderCount = restaurantOrders.length;
      const errorRate = orderCount > 0 ? (errorCount / orderCount) * 100 : 0;
      
      // Calculate total financial impact
      const totalFinancialImpact = restaurantErrors.reduce((sum, e) => sum + (e.financial_impact || 0), 0);
      
      // Group by day of week
      const weekdayData: Record<number, { errors: number; orders: number }> = {};
      restaurantErrors.forEach(e => {
        if (!e.error_date) return;
        const errorDate = new Date(e.error_date);
        const weekday = errorDate.getDay();
        if (!weekdayData[weekday]) {
          weekdayData[weekday] = { errors: 0, orders: 0 };
        }
        weekdayData[weekday].errors += 1;
      });
      
      // Count orders by weekday
      restaurantOrders.forEach(o => {
        if (!o.order_datetime) return;
        const orderDate = new Date(o.order_datetime);
        const weekday = orderDate.getDay();
        if (!weekdayData[weekday]) {
          weekdayData[weekday] = { errors: 0, orders: 0 };
        }
        weekdayData[weekday].orders += 1;
      });

      // Group by hour
      const hourlyData: Record<number, { errors: number; orders: number }> = {};
      restaurantErrors.forEach(e => {
        if (!e.error_date) return;
        const hour = new Date(e.error_date).getHours();
        if (!hourlyData[hour]) {
          hourlyData[hour] = { errors: 0, orders: 0 };
        }
        hourlyData[hour].errors += 1;
      });
      
      restaurantOrders.forEach(o => {
        if (!o.order_datetime) return;
        const hour = new Date(o.order_datetime).getHours();
        if (!hourlyData[hour]) {
          hourlyData[hour] = { errors: 0, orders: 0 };
        }
        hourlyData[hour].orders += 1;
      });

      // Group by error type
      const errorTypes: Record<string, number> = {};
      restaurantErrors.forEach(e => {
        const type = e.error_type || "Autre";
        errorTypes[type] = (errorTypes[type] || 0) + 1;
      });
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        errorRate,
        errorCount,
        orderCount,
        totalFinancialImpact,
        weekdayData,
        hourlyData,
        errorTypes,
      };
    });
    
    // Sort by error rate (lowest first = best)
    return stats.sort((a, b) => a.errorRate - b.errorRate);
  }, [orderErrorsData, orderHistoryData, pinnedRestaurants]);

  const periodLabel = useMemo(() => {
    return `${format(dateRange.start, "d MMM", { locale: fr })} - ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
  }, [dateRange]);

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
                <TrendingDown className="h-6 w-6 text-red-500" />
                <h1 className="text-2xl font-bold">Comparaison Commandes incorrectes</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Analyse comparative des restaurants épinglés
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
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
            {/* Insights Section */}
            <InaccurateOrdersInsightsSection stats={restaurantStats} period={period} />

            {/* Ranking - Full Width */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Classement par taux d'erreur</CardTitle>
              </CardHeader>
              <CardContent>
                <InaccurateOrdersRankingBars stats={restaurantStats} />
              </CardContent>
            </Card>

            {/* Heatmap */}
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
