import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, getDay, subYears, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, Percent, RefreshCw, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import { ProfitabilityRankingBars } from "@/components/compare/ProfitabilityRankingBars";
import { ProfitabilityInsightsSection } from "@/components/compare/ProfitabilityInsightsSection";
import { ProfitabilityHeatmapGrid } from "@/components/compare/ProfitabilityHeatmapGrid";
import { ProfitabilityEvolutionChart } from "@/components/compare/ProfitabilityEvolutionChart";
import { ProfitabilityComparisonChart } from "@/components/compare/ProfitabilityComparisonChart";

// Type for the RPC result
interface DailyProfitabilityRow {
  restaurant_id: string;
  day: string;
  sales: number;
  payout: number;
  orders_count: number;
}

const ProfitabilityComparison = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Period state - same as Overview
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>("previous_week");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [showDebug, setShowDebug] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<"yearOverYear" | "rollingPeriod">("yearOverYear");

  // Calculate date range based on period mode
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodMode) {
      case "previous_week": {
        const lastWeekEnd = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
        const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
        return { start: lastWeekStart, end: lastWeekEnd };
      }
      case "7d": {
        return { start: subDays(now, 6), end: now };
      }
      case "30d": {
        return { start: subDays(now, 29), end: now };
      }
      case "current_month": {
        return { start: startOfMonth(now), end: now };
      }
      case "custom_month": {
        const monthDate = new Date(selectedYear, selectedMonth - 1, 1);
        return { start: startOfMonth(monthDate), end: endOfMonth(monthDate) };
      }
      case "year": {
        const yearDate = new Date(selectedYear, 0, 1);
        return { start: startOfYear(yearDate), end: endOfYear(yearDate) };
      }
      case "custom_range": {
        if (customDateRange?.from && customDateRange?.to) {
          return { start: customDateRange.from, end: customDateRange.to };
        }
        return { start: subDays(now, 7), end: now };
      }
      default:
        return { start: subDays(now, 7), end: now };
    }
  }, [periodMode, selectedYear, selectedMonth, customDateRange]);

  // Calculate previous date range for comparison
  const previousDateRange = useMemo(() => {
    if (comparisonMode === "rollingPeriod") {
      return {
        start: subWeeks(dateRange.start, 4),
        end: subWeeks(dateRange.end, 4),
      };
    }
    return {
      start: subYears(dateRange.start, 1),
      end: subYears(dateRange.end, 1),
    };
  }, [dateRange, comparisonMode]);

  // Derive period type for child components
  const periodType = useMemo(() => {
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return "week";
    if (days <= 31) return "month";
    return "quarter";
  }, [dateRange]);

  // Fetch pinned restaurants only
  const { data: pinnedRestaurants } = useQuery({
    queryKey: ["pinned-restaurants-profitability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, uber_commission_rate, is_pinned")
        .eq("is_pinned", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
  });

  // Fetch payouts data for the period (for aggregated stats like promo, refunds, uber fees)
  const { data: payoutsData } = useQuery({
    queryKey: ["profitability-comparison-payouts", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const startStr = format(dateRange.start, "yyyy-MM-dd");
      const endStr = format(dateRange.end, "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .in("restaurant_id", pinnedRestaurants.map(r => r.id))
        .gte("payout_date", startStr)
        .lte("payout_date", endStr);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!pinnedRestaurants?.length,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch daily aggregated data using RPC (NO more pagination issues!)
  const { data: dailyAggregatedData, isLoading } = useQuery({
    queryKey: ["profitability-daily-rpc", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const startStr = format(dateRange.start, "yyyy-MM-dd");
      const endStr = format(dateRange.end, "yyyy-MM-dd");
      
      const { data, error } = await supabase.rpc("get_profitability_daily", {
        p_restaurant_ids: pinnedRestaurants.map(r => r.id),
        p_start_date: startStr,
        p_end_date: endStr,
      });
      
      if (error) throw error;
      return (data || []) as DailyProfitabilityRow[];
    },
    enabled: !!pinnedRestaurants?.length,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch previous period daily data for comparison chart
  const { data: previousDailyData } = useQuery({
    queryKey: ["profitability-daily-prev", pinnedRestaurants?.map(r => r.id), previousDateRange.start, previousDateRange.end],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const startStr = format(previousDateRange.start, "yyyy-MM-dd");
      const endStr = format(previousDateRange.end, "yyyy-MM-dd");
      
      const { data, error } = await supabase.rpc("get_profitability_daily", {
        p_restaurant_ids: pinnedRestaurants.map(r => r.id),
        p_start_date: startStr,
        p_end_date: endStr,
      });
      
      if (error) throw error;
      return (data || []) as DailyProfitabilityRow[];
    },
    enabled: !!pinnedRestaurants?.length,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Debug info
  const debugInfo = useMemo(() => {
    if (!dailyAggregatedData?.length) return null;
    const uniqueDays = [...new Set(dailyAggregatedData.map(d => d.day))].sort();
    const totalOrders = dailyAggregatedData.reduce((sum, d) => sum + Number(d.orders_count || 0), 0);
    return {
      totalRows: dailyAggregatedData.length,
      totalOrders,
      minDate: uniqueDays[0] || "N/A",
      maxDate: uniqueDays[uniqueDays.length - 1] || "N/A",
      uniqueDays: uniqueDays.length,
      periodStart: format(dateRange.start, "dd/MM/yyyy"),
      periodEnd: format(dateRange.end, "dd/MM/yyyy"),
    };
  }, [dailyAggregatedData, dateRange]);

  // Refresh function
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["profitability-daily-rpc"] });
    queryClient.invalidateQueries({ queryKey: ["profitability-daily-prev"] });
    queryClient.invalidateQueries({ queryKey: ["profitability-comparison-payouts"] });
  };

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!pinnedRestaurants?.length) return [];
    
    const stats = pinnedRestaurants.map(restaurant => {
      const restaurantPayouts = payoutsData?.filter(d => d.restaurant_id === restaurant.id) || [];
      const restaurantDailyData = dailyAggregatedData?.filter(d => d.restaurant_id === restaurant.id) || [];
      
      // Aggregate totals from payouts (for accurate overall stats including promo, fees, refunds)
      const totalSalesFromPayouts = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.sales_incl_vat) || 0), 0);
      const totalNetPayout = restaurantPayouts.reduce((sum, p) => sum + Number(p.net_payout || 0), 0);
      const totalMealVoucher = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.meal_voucher_amount) || 0), 0);
      const totalOrdersFromPayouts = restaurantPayouts.reduce((sum, p) => sum + Number(p.order_count || 0), 0);
      const totalPromo = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.item_promo_incl_vat) || 0), 0);
      const totalRefund = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.refund_incl_vat) || 0), 0);
      const totalUberFee = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.uber_fee_after_promo_incl_vat) || 0), 0);
      
      // Use RPC data for daily/evolution charts (more reliable!)
      const totalSalesFromRPC = restaurantDailyData.reduce((sum, d) => sum + Number(d.sales || 0), 0);
      const totalPayoutFromRPC = restaurantDailyData.reduce((sum, d) => sum + Number(d.payout || 0), 0);
      const totalOrdersFromRPC = restaurantDailyData.reduce((sum, d) => sum + Number(d.orders_count || 0), 0);
      
      // Calculate profitability from payouts (most accurate for totals)
      const totalPayout = totalNetPayout + totalMealVoucher;
      const profitability = totalSalesFromPayouts > 0 ? (totalPayout / totalSalesFromPayouts) * 100 : 0;
      
      // Calculate rates
      const uberFeeRate = totalSalesFromPayouts > 0 ? (totalUberFee / totalSalesFromPayouts) * 100 : 0;
      const promoRate = totalSalesFromPayouts > 0 ? (totalPromo / totalSalesFromPayouts) * 100 : 0;
      const refundRate = totalSalesFromPayouts > 0 ? (totalRefund / totalSalesFromPayouts) * 100 : 0;
      
      // Build dailyData from RPC result (already aggregated by day!)
      const dailyData: Record<string, { sales: number; payout: number; orders: number }> = {};
      restaurantDailyData.forEach(d => {
        dailyData[d.day] = {
          sales: Number(d.sales || 0),
          payout: Number(d.payout || 0),
          orders: Number(d.orders_count || 0),
        };
      });

      // Group by day of week from RPC data
      const weekdayData: Record<number, { sales: number; payout: number; count: number }> = {};
      restaurantDailyData.forEach(d => {
        const date = new Date(d.day);
        const weekday = getDay(date);
        if (!weekdayData[weekday]) {
          weekdayData[weekday] = { sales: 0, payout: 0, count: 0 };
        }
        weekdayData[weekday].sales += Number(d.sales || 0);
        weekdayData[weekday].payout += Number(d.payout || 0);
        weekdayData[weekday].count += Number(d.orders_count || 0);
      });
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        profitability,
        totalSales: totalSalesFromPayouts || totalSalesFromRPC,
        totalPayout: totalPayout || totalPayoutFromRPC,
        totalOrders: totalOrdersFromPayouts || totalOrdersFromRPC,
        uberFeeRate,
        promoRate,
        refundRate,
        avgBasket: totalOrdersFromPayouts > 0 ? totalSalesFromPayouts / totalOrdersFromPayouts : 0,
        dailyData,
        weekdayData,
        payoutsCount: restaurantPayouts.length,
        contractRate: restaurant.uber_commission_rate,
      };
    });
    
    // Sort by profitability (highest first)
    return stats.sort((a, b) => b.profitability - a.profitability);
  }, [payoutsData, dailyAggregatedData, pinnedRestaurants]);

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
                <Percent className="h-6 w-6 text-emerald-500" />
                <h1 className="text-2xl font-bold">Comparaison Rentabilité</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Analyse comparative des restaurants épinglés
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              title="Rafraîchir les données"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant={showDebug ? "default" : "outline"}
              size="icon"
              onClick={() => setShowDebug(!showDebug)}
              title="Afficher/Masquer debug"
            >
              <Bug className="h-4 w-4" />
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

        {/* Debug Panel */}
        {showDebug && debugInfo && (
          <Card className="bg-yellow-500/10 border-yellow-500/50">
            <CardContent className="py-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div><strong>Période:</strong> {debugInfo.periodStart} → {debugInfo.periodEnd}</div>
                <div><strong>Lignes RPC:</strong> {debugInfo.totalRows}</div>
                <div><strong>Commandes totales:</strong> {debugInfo.totalOrders.toLocaleString()}</div>
                <div><strong>Jours uniques:</strong> {debugInfo.uniqueDays}</div>
                <div><strong>Min date:</strong> {debugInfo.minDate}</div>
                <div><strong>Max date:</strong> {debugInfo.maxDate}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid gap-6">
            {/* NEW: Profitability Comparison Chart (Period vs Period) */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardContent className="pt-6">
                <ProfitabilityComparisonChart 
                  currentPeriodData={dailyAggregatedData || []}
                  previousPeriodData={previousDailyData || []}
                  dateRange={dateRange}
                  previousDateRange={previousDateRange}
                  comparisonMode={comparisonMode}
                  onComparisonModeChange={setComparisonMode}
                />
              </CardContent>
            </Card>

            {/* Insights Section */}
            <ProfitabilityInsightsSection stats={restaurantStats} period={periodType} />

            {/* Ranking - Full Width */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Classement par rentabilité</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfitabilityRankingBars stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>

            {/* Evolution Chart */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Évolution par restaurant</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfitabilityEvolutionChart 
                  stats={restaurantStats} 
                  dateRange={dateRange} 
                  restaurantIds={pinnedRestaurants?.map(r => r.id)}
                />
              </CardContent>
            </Card>

            {/* Heatmap */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Patterns de rentabilité par jour</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfitabilityHeatmapGrid stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfitabilityComparison;