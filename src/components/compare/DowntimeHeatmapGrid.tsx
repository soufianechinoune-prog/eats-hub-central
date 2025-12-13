import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { extractCityName } from "@/lib/restaurantUtils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

interface RestaurantStat {
  id: string;
  name: string;
  totalOfflineMinutes: number;
  hourlyData: Record<number, number>;
  weekdayData: Record<number, number>;
}

interface DowntimeHeatmapGridProps {
  stats: RestaurantStat[];
  dateRange?: { start: Date; end: Date };
}

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const getIntensityColor = (value: number, max: number): string => {
  if (value === 0) return "bg-emerald-500/20";
  const intensity = value / max;
  if (intensity <= 0.25) return "bg-amber-400/40";
  if (intensity <= 0.5) return "bg-orange-400/60";
  if (intensity <= 0.75) return "bg-orange-500/80";
  return "bg-red-500";
};

export const DowntimeHeatmapGrid = ({ stats, dateRange }: DowntimeHeatmapGridProps) => {
  const navigate = useNavigate();
  const { 
    setSelectedRestaurants, 
    setPeriodMode, 
    setSelectedMonth,
    setSelectedYear 
  } = useAnalyticsContext();

  // Aggregate by day x hour across all restaurants
  const heatmapData = useMemo(() => {
    const grid: Record<string, number> = {};
    let maxValue = 0;

    stats.forEach(stat => {
      Object.entries(stat.weekdayData).forEach(([day]) => {
        Object.entries(stat.hourlyData).forEach(([hour, minutes]) => {
          const key = `${day}-${hour}`;
          grid[key] = (grid[key] || 0) + minutes;
          if (grid[key] > maxValue) maxValue = grid[key];
        });
      });
    });

    return { grid, maxValue };
  }, [stats]);

  // Per-restaurant weekly view
  const restaurantWeeklyData = useMemo(() => {
    return stats.map(stat => {
      const maxValue = Math.max(...Object.values(stat.weekdayData), 1);
      return {
        ...stat,
        maxValue,
      };
    });
  }, [stats]);

  const handleCellClick = (restaurantId: string, restaurantName: string) => {
    // Get the date from dateRange for context
    const targetDate = dateRange?.start || new Date();
    
    // Update analytics context
    setSelectedRestaurants([restaurantId]);
    setPeriodMode("month");
    setSelectedMonth(targetDate.getMonth() + 1);
    setSelectedYear(targetDate.getFullYear());
    
    // Navigate to operations analytics
    navigate("/analytics?view=operations");
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
          Inactivité par jour de la semaine
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
                    const value = stat.weekdayData[dayIndex] || 0;
                    return (
                      <Tooltip key={dayIndex}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => handleCellClick(stat.id, stat.name)}
                            className={cn(
                              "flex-1 h-8 rounded transition-all hover:scale-105 cursor-pointer flex items-center justify-center hover:ring-2 hover:ring-primary/50",
                              getIntensityColor(value, stat.maxValue)
                            )}
                          >
                            <span className="text-xs font-medium text-foreground/80">
                              {day}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{cityName}</p>
                          <p>{day}: {formatMinutesToDisplay(value)}</p>
                          <p className="text-xs text-muted-foreground mt-1">Cliquer pour voir les détails</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <span className="text-sm tabular-nums w-20 text-right">
                  {formatMinutesToDisplay(stat.totalOfflineMinutes)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Color legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-500/20" />
          <span>0 min</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-400/40" />
          <span>Faible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-orange-400/60" />
          <span>Modéré</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span>Élevé</span>
        </div>
      </div>
    </div>
  );
};
