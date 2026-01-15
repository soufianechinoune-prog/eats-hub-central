import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import { ProfitabilityRankingBars } from "@/components/compare/ProfitabilityRankingBars";
import { ProfitabilityInsightsSection } from "@/components/compare/ProfitabilityInsightsSection";
import { ProfitabilityHeatmapGrid } from "@/components/compare/ProfitabilityHeatmapGrid";
import { ProfitabilityEvolutionChart } from "@/components/compare/ProfitabilityEvolutionChart";

const ProfitabilityComparison = () => {
  const navigate = useNavigate();
  
  // Period state - same as Overview
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>("previous_week");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

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
    staleTime: 0, // Toujours refetch pour avoir les données fraîches
  });

  // Fetch payouts data for the period
  const { data: payoutsData, isLoading } = useQuery({
    queryKey: ["profitability-comparison", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
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
  });

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!payoutsData?.length || !pinnedRestaurants?.length) return [];
    
    const stats = pinnedRestaurants.map(restaurant => {
      const restaurantPayouts = payoutsData.filter(d => d.restaurant_id === restaurant.id);
      
      // Aggregate totals
      const totalSales = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.sales_incl_vat) || 0), 0);
      const totalNetPayout = restaurantPayouts.reduce((sum, p) => sum + Number(p.net_payout || 0), 0);
      const totalMealVoucher = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.meal_voucher_amount) || 0), 0);
      const totalOrders = restaurantPayouts.reduce((sum, p) => sum + Number(p.order_count || 0), 0);
      const totalPromo = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.item_promo_incl_vat) || 0), 0);
      const totalRefund = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.refund_incl_vat) || 0), 0);
      const totalUberFee = restaurantPayouts.reduce((sum, p) => sum + Math.abs(Number(p.uber_fee_after_promo_incl_vat) || 0), 0);
      
      // Calculate profitability
      const totalPayout = totalNetPayout + totalMealVoucher;
      const profitability = totalSales > 0 ? (totalPayout / totalSales) * 100 : 0;
      
      // Calculate rates
      const uberFeeRate = totalSales > 0 ? (totalUberFee / totalSales) * 100 : 0;
      const promoRate = totalSales > 0 ? (totalPromo / totalSales) * 100 : 0;
      const refundRate = totalSales > 0 ? (totalRefund / totalSales) * 100 : 0;
      
      // Group by date for daily evolution
      const dailyData: Record<string, { sales: number; payout: number; orders: number }> = {};
      restaurantPayouts.forEach(p => {
        if (p.payout_date) {
          const date = p.payout_date;
          if (!dailyData[date]) {
            dailyData[date] = { sales: 0, payout: 0, orders: 0 };
          }
          dailyData[date].sales += Math.abs(Number(p.sales_incl_vat) || 0);
          dailyData[date].payout += Number(p.net_payout || 0) + Math.abs(Number(p.meal_voucher_amount) || 0);
          dailyData[date].orders += Number(p.order_count || 0);
        }
      });

      // Group by day of week
      const weekdayData: Record<number, { sales: number; payout: number; count: number }> = {};
      restaurantPayouts.forEach(p => {
        if (p.payout_date) {
          const date = new Date(p.payout_date);
          const weekday = date.getDay();
          if (!weekdayData[weekday]) {
            weekdayData[weekday] = { sales: 0, payout: 0, count: 0 };
          }
          weekdayData[weekday].sales += Math.abs(Number(p.sales_incl_vat) || 0);
          weekdayData[weekday].payout += Number(p.net_payout || 0) + Math.abs(Number(p.meal_voucher_amount) || 0);
          weekdayData[weekday].count += 1;
        }
      });
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        profitability,
        totalSales,
        totalPayout,
        totalOrders,
        uberFeeRate,
        promoRate,
        refundRate,
        avgBasket: totalOrders > 0 ? totalSales / totalOrders : 0,
        dailyData,
        weekdayData,
        payoutsCount: restaurantPayouts.length,
        contractRate: restaurant.uber_commission_rate,
      };
    });
    
    // Sort by profitability (highest first)
    return stats.sort((a, b) => b.profitability - a.profitability);
  }, [payoutsData, pinnedRestaurants]);

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

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid gap-6">
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
                <CardTitle className="text-lg">Évolution de la rentabilité</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfitabilityEvolutionChart stats={restaurantStats} dateRange={dateRange} />
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
