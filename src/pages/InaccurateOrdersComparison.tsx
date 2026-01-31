import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, parseISO, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar, TrendingDown, AlertTriangle, FileUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

  // Fetch daily order accuracy data (aggregated from Uber dashboard)
  const { data: orderAccuracyData, isLoading: accuracyLoading } = useQuery({
    queryKey: ["inaccurate-orders-comparison-accuracy", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const { data, error } = await supabase
        .from("daily_order_accuracy")
        .select("*")
        .eq("period_type", "current")
        .in("restaurant_id", pinnedRestaurants.map(r => r.id))
        .gte("date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("date", format(dateRange.end, "yyyy-MM-dd"));
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!pinnedRestaurants?.length,
  });

  // Fetch latest accuracy date to check data coverage
  const { data: latestErrorDate } = useQuery({
    queryKey: ["latest-accuracy-date"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_order_accuracy")
        .select("date")
        .order("date", { ascending: false })
        .limit(1)
        .single();
      
      if (error) return null;
      return data?.date ? parseISO(data.date) : null;
    },
  });

  // Fetch order counts from daily_sales_uber for the period
  const { data: orderCountsData, isLoading: ordersLoading } = useQuery({
    queryKey: ["inaccurate-orders-comparison-sales", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const { data, error } = await supabase
        .from("daily_sales_uber_deduped")
        .select("restaurant_id, date, order_count")
        .in("restaurant_id", pinnedRestaurants.map(r => r.id))
        .gte("date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("date", format(dateRange.end, "yyyy-MM-dd"))
        .order("date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!pinnedRestaurants?.length,
  });

  const isLoading = accuracyLoading || ordersLoading;

  // Check if data is incomplete for selected period
  const dataIncomplete = useMemo(() => {
    if (!latestErrorDate) return true;
    return isAfter(dateRange.end, latestErrorDate);
  }, [latestErrorDate, dateRange.end]);

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!orderAccuracyData || !pinnedRestaurants?.length) return [];
    
    // Build order counts by restaurant and weekday
    const orderCountsByRestaurant: Record<string, {
      total: number;
      weekday: Record<number, number>;
    }> = {};
    
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
    
    const stats = pinnedRestaurants.map(restaurant => {
      const accuracyRecords = orderAccuracyData.filter(d => d.restaurant_id === restaurant.id);
      const orderData = orderCountsByRestaurant[restaurant.id] || { total: 0, weekday: {} };
      
      // Aggregate error counts from daily_order_accuracy
      const errorCount = accuracyRecords.reduce((sum, r) => sum + (r.incorrect_orders_count || 0), 0);
      const totalRefund = accuracyRecords.reduce((sum, r) => sum + (r.total_refund || 0), 0);
      
      // Category breakdown
      const missingItems = accuracyRecords.reduce((sum, r) => sum + (r.missing_items_count || 0), 0);
      const missingCustomizations = accuracyRecords.reduce((sum, r) => sum + (r.missing_customization_count || 0), 0);
      const incorrectItems = accuracyRecords.reduce((sum, r) => sum + (r.incorrect_item_count || 0), 0);
      const wrongOrders = accuracyRecords.reduce((sum, r) => sum + (r.wrong_order_count || 0), 0);
      
      // Refund breakdown
      const missingItemsRefund = accuracyRecords.reduce((sum, r) => sum + (r.missing_items_refund || 0), 0);
      const missingCustomizationsRefund = accuracyRecords.reduce((sum, r) => sum + (r.missing_customization_refund || 0), 0);
      const incorrectItemRefund = accuracyRecords.reduce((sum, r) => sum + (r.incorrect_item_refund || 0), 0);
      const wrongOrderRefund = accuracyRecords.reduce((sum, r) => sum + (r.wrong_order_refund || 0), 0);
      
      const orderCount = orderData.total;
      const errorRate = orderCount > 0 ? (errorCount / orderCount) * 100 : 0;
      
      // Group errors by day of week
      const weekdayData: Record<number, { errors: number; orders: number }> = {};
      for (let i = 0; i <= 6; i++) {
        weekdayData[i] = { errors: 0, orders: orderData.weekday[i] || 0 };
      }
      accuracyRecords.forEach(r => {
        if (!r.date) return;
        const weekday = parseISO(r.date).getDay();
        weekdayData[weekday].errors += r.incorrect_orders_count || 0;
      });

      // Build error types for compatibility
      const errorTypes: Record<string, number> = {};
      if (missingItems > 0) errorTypes["Articles manquants"] = missingItems;
      if (missingCustomizations > 0) errorTypes["Personnalisations manquantes"] = missingCustomizations;
      if (incorrectItems > 0) errorTypes["Article incorrect"] = incorrectItems;
      if (wrongOrders > 0) errorTypes["Commande incorrecte"] = wrongOrders;
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        errorRate,
        errorCount,
        orderCount,
        totalFinancialImpact: totalRefund,
        weekdayData,
        hourlyData: {} as Record<number, { errors: number; orders: number }>, // Not available in aggregated data
        errorTypes,
        // Additional category details
        categoryBreakdown: {
          missingItems,
          missingCustomizations,
          incorrectItems,
          wrongOrders,
        },
        refundBreakdown: {
          missingItemsRefund,
          missingCustomizationsRefund,
          incorrectItemRefund,
          wrongOrderRefund,
        },
      };
    });
    
    // Sort by error rate (lowest first = best)
    return stats.sort((a, b) => a.errorRate - b.errorRate);
  }, [orderAccuracyData, orderCountsData, pinnedRestaurants]);

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
            {/* Warning if data is incomplete */}
            {dataIncomplete && latestErrorDate && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-600">Données incomplètes</AlertTitle>
                <AlertDescription className="text-amber-600/80">
                  Les données d'erreurs s'arrêtent au <strong>{format(latestErrorDate, "d MMMM yyyy", { locale: fr })}</strong>.
                  Pour avoir les données complètes, importez le fichier <strong>"Inaccurate Orders"</strong> (inaccurate_orders_v3_xxx.csv) 
                  depuis Uber Eats Manager → Rapports → Qualité des commandes.
                  <Button 
                    variant="link" 
                    className="p-0 h-auto ml-2 text-amber-600 underline"
                    onClick={() => navigate("/reports")}
                  >
                    <FileUp className="h-3 w-3 mr-1" />
                    Importer
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Insights Section */}
            <InaccurateOrdersInsightsSection stats={restaurantStats} period={period} />

            {/* Ranking - Full Width */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Classement par taux d'erreur</CardTitle>
              </CardHeader>
              <CardContent>
                <InaccurateOrdersRankingBars stats={restaurantStats} dateRange={dateRange} />
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
