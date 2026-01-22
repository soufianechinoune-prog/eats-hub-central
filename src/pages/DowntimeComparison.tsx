import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DowntimeRankingBars } from "@/components/compare/DowntimeRankingBars";
import { DowntimeEvolutionChart } from "@/components/compare/DowntimeEvolutionChart";
import { DowntimeInsightsSection } from "@/components/compare/DowntimeInsightsSection";
import { DowntimeHeatmapGrid } from "@/components/compare/DowntimeHeatmapGrid";

type PeriodType = "week" | "month" | "quarter";

const DowntimeComparison = () => {
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

  // Fetch hourly availability data for pinned restaurants
  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ["downtime-comparison", pinnedRestaurants?.map(r => r.id), dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!pinnedRestaurants?.length) return [];
      
      const { data, error } = await supabase
        .from("hourly_availability")
        .select("*")
        .in("restaurant_id", pinnedRestaurants.map(r => r.id))
        .gte("hour_start", dateRange.start.toISOString())
        .lte("hour_start", dateRange.end.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!pinnedRestaurants?.length,
  });

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!availabilityData?.length || !pinnedRestaurants?.length) return [];
    
    const stats = pinnedRestaurants.map(restaurant => {
      const restaurantData = availabilityData.filter(d => d.restaurant_id === restaurant.id);
      const totalOffline = restaurantData.reduce((sum, d) => sum + (d.offline_minutes || 0), 0);
      const totalOnline = restaurantData.reduce((sum, d) => sum + (d.online_minutes || 0), 0);
      const totalMinutes = totalOffline + totalOnline;
      const availabilityRate = totalMinutes > 0 ? ((totalOnline / totalMinutes) * 100) : 100;
      
      // Group by date for daily evolution
      const dailyData: Record<string, number> = {};
      restaurantData.forEach(d => {
        const date = format(parseISO(d.hour_start), "yyyy-MM-dd");
        dailyData[date] = (dailyData[date] || 0) + (d.offline_minutes || 0);
      });

      // Group by hour for heatmap
      const hourlyData: Record<number, number> = {};
      restaurantData.forEach(d => {
        const hour = parseISO(d.hour_start).getHours();
        hourlyData[hour] = (hourlyData[hour] || 0) + (d.offline_minutes || 0);
      });

      // Group by day of week
      const weekdayData: Record<number, number> = {};
      restaurantData.forEach(d => {
        const weekday = parseISO(d.hour_start).getDay();
        weekdayData[weekday] = (weekdayData[weekday] || 0) + (d.offline_minutes || 0);
      });
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        totalOfflineMinutes: totalOffline,
        availabilityRate,
        dailyData,
        hourlyData,
        weekdayData,
      };
    });
    
    return stats.sort((a, b) => a.totalOfflineMinutes - b.totalOfflineMinutes);
  }, [availabilityData, pinnedRestaurants]);

  // Prepare evolution chart data
  const evolutionData = useMemo(() => {
    if (!restaurantStats.length) return [];
    
    // Get all unique dates
    const allDates = new Set<string>();
    restaurantStats.forEach(r => {
      Object.keys(r.dailyData).forEach(date => allDates.add(date));
    });
    
    return Array.from(allDates)
      .sort()
      .map(date => {
        const entry: Record<string, string | number> = { date };
        restaurantStats.forEach(r => {
          entry[r.name] = r.dailyData[date] || 0;
        });
        return entry;
      });
  }, [restaurantStats]);

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
              <h1 className="text-2xl font-bold">Comparaison Temps d'inactivité</h1>
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
            <DowntimeInsightsSection stats={restaurantStats} period={period} />

            {/* Ranking + Evolution */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Classement par disponibilité</CardTitle>
                </CardHeader>
                <CardContent>
                  <DowntimeRankingBars stats={restaurantStats} dateRange={dateRange} />
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Évolution journalière</CardTitle>
                </CardHeader>
                <CardContent>
                  <DowntimeEvolutionChart data={evolutionData} restaurants={restaurantStats.map(r => r.name)} />
                </CardContent>
              </Card>
            </div>

            {/* Heatmap */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Patterns d'inactivité</CardTitle>
              </CardHeader>
              <CardContent>
                <DowntimeHeatmapGrid stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default DowntimeComparison;
