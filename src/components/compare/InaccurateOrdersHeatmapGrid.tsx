import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { extractCityName } from "@/lib/restaurantUtils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

interface RestaurantStat {
  id: string;
  name: string;
  errorRate: number;
  weekdayData: Record<number, { errors: number; orders: number }>;
}

interface InaccurateOrdersHeatmapGridProps {
  stats: RestaurantStat[];
  dateRange?: { start: Date; end: Date };
}

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const getIntensityColor = (errorRate: number, hasData: boolean): string => {
  if (!hasData) return "bg-muted/50";
  if (errorRate <= 1) return "bg-emerald-500/60";
  if (errorRate <= 2) return "bg-emerald-400/50";
  if (errorRate <= 3) return "bg-amber-400/50";
  if (errorRate <= 5) return "bg-orange-400/60";
  return "bg-red-500/70";
};

export const InaccurateOrdersHeatmapGrid = ({ stats, dateRange }: InaccurateOrdersHeatmapGridProps) => {
  const navigate = useNavigate();
  const { 
    setSelectedRestaurants, 
    setPeriodMode, 
    setSelectedMonth,
    setSelectedYear 
  } = useAnalyticsContext();

  // Per-restaurant weekly view with error rate per day
  const restaurantWeeklyData = useMemo(() => {
    return stats.map(stat => {
      const weekdayRates: Record<number, { rate: number; hasData: boolean }> = {};
      Object.entries(stat.weekdayData).forEach(([day, data]) => {
        if (data.orders > 0) {
          weekdayRates[Number(day)] = {
            rate: (data.errors / data.orders) * 100,
            hasData: true,
          };
        } else {
          weekdayRates[Number(day)] = { rate: 0, hasData: false };
        }
      });
      
      return {
        ...stat,
        weekdayRates,
      };
    });
  }, [stats]);

  const handleCellClick = (restaurantId: string, dayIndex: number) => {
    const startDate = dateRange?.start || new Date();
    const startDayOfWeek = startDate.getDay();
    
    let daysToAdd = dayIndex - startDayOfWeek;
    if (daysToAdd < 0) daysToAdd += 7;
    
    const targetDate = new Date(startDate);
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    
    const dayString = format(targetDate, "yyyy-MM-dd");
    
    setSelectedRestaurants([restaurantId]);
    setPeriodMode("month");
    setSelectedMonth(targetDate.getMonth() + 1);
    setSelectedYear(targetDate.getFullYear());
    
    navigate(`/analytics/operations?day=${dayString}`);
  };

  if (stats.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Per-restaurant weekly breakdown */}
      <div>
        <h4 className="text-sm font-medium mb-3 text-muted-foreground">
          Taux d'erreur par jour de la semaine
        </h4>
        <div className="space-y-3">
          {restaurantWeeklyData.map(stat => {
            const cityName = extractCityName(stat.name);
            return (
              <div key={stat.id} className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-24 text-sm font-medium truncate cursor-help">{cityName}</span>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{stat.name}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex gap-1 flex-1">
                  {WEEKDAYS.map((day, dayIndex) => {
                    const data = stat.weekdayRates[dayIndex] || { rate: 0, hasData: false };
                    return (
                      <Tooltip key={dayIndex}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => handleCellClick(stat.id, dayIndex)}
                            className={cn(
                              "flex-1 h-8 rounded transition-all hover:scale-105 cursor-pointer flex items-center justify-center hover:ring-2 hover:ring-primary/50",
                              getIntensityColor(data.rate, data.hasData)
                            )}
                          >
                            <span className="text-xs font-medium text-foreground/80">
                              {day}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{cityName}</p>
                          <p>{day}: {data.hasData ? `${data.rate.toFixed(1)}% d'erreurs` : "Pas de données"}</p>
                          <p className="text-xs text-muted-foreground mt-1">Cliquer pour voir les détails</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <span className="text-sm tabular-nums w-16 text-right">
                  {stat.errorRate.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Color legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-500/60" />
          <span>≤1%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-400/50" />
          <span>≤2%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-400/50" />
          <span>≤3%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-orange-400/60" />
          <span>≤5%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-500/70" />
          <span>&gt;5%</span>
        </div>
      </div>
    </div>
  );
};
