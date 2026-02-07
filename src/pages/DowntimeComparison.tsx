import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DowntimeRankingBars } from "@/components/compare/DowntimeRankingBars";
import { DowntimeInsightsSection } from "@/components/compare/DowntimeInsightsSection";
import { DowntimeHeatmapGrid } from "@/components/compare/DowntimeHeatmapGrid";
import { NetworkViewToggle } from "@/components/compare/NetworkViewToggle";
import { OverviewPeriodSelector, type OverviewPeriodMode } from "@/components/overview/OverviewPeriodSelector";
import type { DateRange } from "react-day-picker";

const DowntimeComparison = () => {
  const navigate = useNavigate();
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>("previous_week");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [isNetworkView, setIsNetworkView] = useState(false);

  // Calculate date range based on period mode
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;
    
    switch (periodMode) {
      case "previous_week": {
        const lastWeek = subWeeks(now, 1);
        start = startOfWeek(lastWeek, { weekStartsOn: 1 });
        end = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      }
      case "7d":
        start = subDays(now, 6);
        end = now;
        break;
      case "30d":
        start = subDays(now, 29);
        end = now;
        break;
      case "current_month":
        start = startOfMonth(now);
        end = now;
        break;
      case "year":
        start = new Date(selectedYear, 0, 1);
        end = new Date(selectedYear, 11, 31);
        break;
      case "custom_month":
        start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
        end = endOfMonth(start);
        break;
      case "custom_range":
        if (customDateRange?.from && customDateRange?.to) {
          start = customDateRange.from;
          end = customDateRange.to;
        } else {
          start = subDays(now, 30);
          end = now;
        }
        break;
      default:
        start = subDays(now, 30);
        end = now;
    }
    
    return { start, end };
  }, [periodMode, selectedYear, selectedMonth, customDateRange]);

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

  // Fetch all active restaurants (for network view)
  const { data: allActiveRestaurants } = useQuery({
    queryKey: ["active-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Select restaurants based on view mode
  const selectedRestaurants = isNetworkView ? allActiveRestaurants : pinnedRestaurants;

  // Fetch hourly availability data for selected restaurants
  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ["downtime-comparison", selectedRestaurants?.map(r => r.id), dateRange.start, dateRange.end, isNetworkView],
    queryFn: async () => {
      if (!selectedRestaurants?.length) return [];
      
      const { data, error } = await supabase
        .from("hourly_availability")
        .select("*")
        .in("restaurant_id", selectedRestaurants.map(r => r.id))
        .gte("hour_start", dateRange.start.toISOString())
        .lte("hour_start", dateRange.end.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRestaurants?.length,
  });

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!selectedRestaurants?.length) return [];
    
    const safeAvailabilityData = availabilityData || [];
    
    const stats = selectedRestaurants.map(restaurant => {
      const restaurantData = safeAvailabilityData.filter(d => d.restaurant_id === restaurant.id);
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
  }, [availabilityData, selectedRestaurants]);

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
                Analyse de {restaurantStats.length} restaurants | {periodLabel}
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

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Insights Section */}
            <DowntimeInsightsSection stats={restaurantStats} period={periodMode} />

            {/* Ranking - Full width */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Classement par disponibilité ({restaurantStats.length} restaurants)</CardTitle>
              </CardHeader>
              <CardContent>
                <DowntimeRankingBars stats={restaurantStats} dateRange={dateRange} />
              </CardContent>
            </Card>

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
