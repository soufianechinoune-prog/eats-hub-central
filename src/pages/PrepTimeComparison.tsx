import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrepTimeRankingBars } from "@/components/compare/PrepTimeRankingBars";
import { PrepTimeInsightsSection } from "@/components/compare/PrepTimeInsightsSection";
import { PrepTimeHeatmapGrid } from "@/components/compare/PrepTimeHeatmapGrid";
import { useAnalyticsContext, Platform } from "@/contexts/AnalyticsContext";
import { UberEatsIcon, DeliverooIcon } from "@/components/icons/PlatformIcons";

type PeriodType = "week" | "month" | "quarter" | "context";

const PrepTimeComparison = () => {
  const navigate = useNavigate();
  const { 
    dateRange: contextDateRange, 
    selectedPlatform: contextPlatform,
    setSelectedPlatform: setContextPlatform,
    periodMode: contextPeriodMode
  } = useAnalyticsContext();
  
  // Determine initial period based on context
  const [period, setPeriod] = useState<PeriodType>(() => {
    if (contextDateRange?.from && contextDateRange?.to) {
      return "context";
    }
    return "week";
  });

  // Calculate date range based on period or context
  const dateRange = useMemo(() => {
    // If using context and context has valid dates
    if (period === "context" && contextDateRange?.from && contextDateRange?.to) {
      return { start: contextDateRange.from, end: contextDateRange.to };
    }
    
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
  }, [period, contextDateRange]);

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

  // Fetch order history data for prep times with platform filter
  const { data: orderHistoryData, isLoading } = useQuery({
    queryKey: ["prep-time-comparison", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end, contextPlatform],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const restaurantIds = pinnedRestaurants.map(r => r.id);
      let allData: typeof data = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      let data: { restaurant_id: string; initial_prep_time_minutes: number | null; order_datetime: string | null; platform: string | null }[] = [];

      while (hasMore) {
        let query = supabase
          .from("order_history")
          .select("restaurant_id, initial_prep_time_minutes, order_datetime, platform")
          .in("restaurant_id", restaurantIds)
          .gte("order_datetime", dateRange.start.toISOString())
          .lte("order_datetime", dateRange.end.toISOString())
          .not("initial_prep_time_minutes", "is", null);
        
        // Apply platform filter if not global
        if (contextPlatform !== "global") {
          query = query.eq("platform", contextPlatform);
        }
        
        const { data: pageData, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        
        if (pageData && pageData.length > 0) {
          allData = [...allData, ...pageData];
          hasMore = pageData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return allData;
    },
    enabled: !!pinnedRestaurants?.length,
  });

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!orderHistoryData?.length || !pinnedRestaurants?.length) return [];
    
    const stats = pinnedRestaurants.map(restaurant => {
      const restaurantData = orderHistoryData.filter(d => d.restaurant_id === restaurant.id);
      
      // Calculate average prep time
      const totalPrepTime = restaurantData.reduce((sum, d) => sum + (d.initial_prep_time_minutes || 0), 0);
      const avgPrepTime = restaurantData.length > 0 ? totalPrepTime / restaurantData.length : 0;
      
      // Group by date for daily evolution
      const dailyData: Record<string, { total: number; count: number }> = {};
      restaurantData.forEach(d => {
        if (!d.order_datetime) return;
        const date = format(parseISO(d.order_datetime), "yyyy-MM-dd");
        if (!dailyData[date]) {
          dailyData[date] = { total: 0, count: 0 };
        }
        dailyData[date].total += d.initial_prep_time_minutes || 0;
        dailyData[date].count += 1;
      });

      // Group by hour for heatmap
      const hourlyData: Record<number, { total: number; count: number }> = {};
      restaurantData.forEach(d => {
        if (!d.order_datetime) return;
        const hour = parseISO(d.order_datetime).getHours();
        if (!hourlyData[hour]) {
          hourlyData[hour] = { total: 0, count: 0 };
        }
        hourlyData[hour].total += d.initial_prep_time_minutes || 0;
        hourlyData[hour].count += 1;
      });

      // Group by day of week - use local timezone for correct day calculation
      const weekdayData: Record<number, { total: number; count: number }> = {};
      restaurantData.forEach(d => {
        if (!d.order_datetime) return;
        // Create date in local timezone instead of UTC to get correct weekday
        const orderDate = new Date(d.order_datetime);
        const weekday = orderDate.getDay();
        if (!weekdayData[weekday]) {
          weekdayData[weekday] = { total: 0, count: 0 };
        }
        weekdayData[weekday].total += d.initial_prep_time_minutes || 0;
        weekdayData[weekday].count += 1;
      });
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        avgPrepTime,
        orderCount: restaurantData.length,
        dailyData,
        hourlyData,
        weekdayData,
      };
    });
    
    // Sort by average prep time (fastest first)
    return stats.sort((a, b) => a.avgPrepTime - b.avgPrepTime);
  }, [orderHistoryData, pinnedRestaurants]);


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
                <Clock className="h-6 w-6 text-amber-500" />
                <h1 className="text-2xl font-bold">Comparaison Temps de préparation</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Analyse comparative des restaurants épinglés
              </p>
            </div>
          </div>
          
        <div className="flex items-center gap-3">
            {/* Platform selector */}
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
              <Button
                variant={contextPlatform === "uber_eats" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 gap-1.5"
                onClick={() => setContextPlatform("uber_eats")}
              >
                <UberEatsIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Uber Eats</span>
              </Button>
              <Button
                variant={contextPlatform === "deliveroo" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 gap-1.5"
                onClick={() => setContextPlatform("deliveroo")}
              >
                <DeliverooIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Deliveroo</span>
              </Button>
              <Button
                variant={contextPlatform === "global" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3"
                onClick={() => setContextPlatform("global")}
              >
                Global
              </Button>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Calendar className="h-4 w-4" />
              <span>{periodLabel}</span>
            </div>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contextDateRange?.from && contextDateRange?.to && (
                  <SelectItem value="context">Période Analytics</SelectItem>
                )}
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
            <PrepTimeInsightsSection stats={restaurantStats} period={period} />

            {/* Ranking - Full Width */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Classement par rapidité</CardTitle>
              </CardHeader>
              <CardContent>
                <PrepTimeRankingBars stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>

            {/* Heatmap */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Patterns de préparation</CardTitle>
              </CardHeader>
              <CardContent>
                <PrepTimeHeatmapGrid stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrepTimeComparison;
