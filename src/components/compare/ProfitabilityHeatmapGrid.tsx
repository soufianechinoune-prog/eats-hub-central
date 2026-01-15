import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RestaurantStats {
  id: string;
  name: string;
  profitability: number;
  weekdayData: Record<number, { sales: number; payout: number; count: number }>;
}

interface ProfitabilityHeatmapGridProps {
  stats: RestaurantStats[];
  dateRange: { start: Date; end: Date };
}

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export const ProfitabilityHeatmapGrid = ({ stats, dateRange }: ProfitabilityHeatmapGridProps) => {
  // Calculate profitability for each restaurant/weekday combination
  const heatmapData = useMemo(() => {
    return stats.map(restaurant => {
      const weekdayProfitability: (number | null)[] = [];
      
      for (let day = 0; day < 7; day++) {
        const data = restaurant.weekdayData[day];
        if (data && data.sales > 0) {
          weekdayProfitability.push((data.payout / data.sales) * 100);
        } else {
          weekdayProfitability.push(null);
        }
      }
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        weekdayProfitability,
        overallProfitability: restaurant.profitability,
      };
    });
  }, [stats]);

  const getCellColor = (profitability: number | null) => {
    if (profitability === null) return "bg-muted/30";
    if (profitability >= 72) return "bg-emerald-500";
    if (profitability >= 70) return "bg-emerald-400";
    if (profitability >= 68) return "bg-green-400";
    if (profitability >= 65) return "bg-lime-400";
    if (profitability >= 62) return "bg-yellow-400";
    if (profitability >= 60) return "bg-amber-400";
    if (profitability >= 55) return "bg-orange-400";
    return "bg-red-400";
  };

  const getCellTextColor = (profitability: number | null) => {
    if (profitability === null) return "text-muted-foreground";
    return "text-white";
  };

  if (!stats.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Aucune donnée disponible pour la heatmap
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header row with weekdays */}
          <div className="grid grid-cols-[180px_repeat(7,1fr)_80px] gap-1 mb-2">
            <div className="text-sm font-medium text-muted-foreground">Restaurant</div>
            {WEEKDAYS.map((day, i) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            <div className="text-right text-sm font-medium text-muted-foreground">Moy.</div>
          </div>
          
          {/* Data rows */}
          {heatmapData.map((restaurant) => (
            <div key={restaurant.id} className="grid grid-cols-[180px_repeat(7,1fr)_80px] gap-1 mb-1">
              <div className="text-sm font-medium truncate pr-2">
                {restaurant.name}
              </div>
              
              {restaurant.weekdayProfitability.map((profitability, dayIndex) => (
                <Tooltip key={dayIndex}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "h-10 rounded flex items-center justify-center text-xs font-semibold transition-colors cursor-default",
                        getCellColor(profitability),
                        getCellTextColor(profitability)
                      )}
                    >
                      {profitability !== null ? `${profitability.toFixed(0)}%` : "-"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-semibold">{restaurant.name} - {WEEKDAYS[dayIndex]}</p>
                      {profitability !== null ? (
                        <p>Rentabilité: {profitability.toFixed(1)}%</p>
                      ) : (
                        <p className="text-muted-foreground">Aucune donnée</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
              
              {/* Average column */}
              <div className={cn(
                "h-10 rounded flex items-center justify-center text-xs font-bold",
                getCellColor(restaurant.overallProfitability),
                getCellTextColor(restaurant.overallProfitability)
              )}>
                {restaurant.overallProfitability.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-500" />
            <span>≥ 72%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-green-400" />
            <span>68-72%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-lime-400" />
            <span>65-68%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-yellow-400" />
            <span>62-65%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-amber-400" />
            <span>60-62%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-red-400" />
            <span>&lt; 60%</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
