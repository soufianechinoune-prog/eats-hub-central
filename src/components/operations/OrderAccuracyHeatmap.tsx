import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OrderError {
  id: string;
  error_date: string | null;
  created_at: string;
  financial_impact: number | null;
}

interface OrderAccuracyHeatmapProps {
  orderErrors: OrderError[];
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 10); // 10h to 23h

export function OrderAccuracyHeatmap({ orderErrors }: OrderAccuracyHeatmapProps) {
  const heatmapData = useMemo(() => {
    const matrix: Record<string, Record<number, { count: number; impact: number }>> = {};
    
    // Initialize matrix
    DAYS.forEach(day => {
      matrix[day] = {};
      HOURS.forEach(hour => {
        matrix[day][hour] = { count: 0, impact: 0 };
      });
    });

    orderErrors.forEach(error => {
      const date = new Date(error.error_date || error.created_at);
      const dayOfWeek = date.getDay();
      // Convert Sunday (0) to 6, Monday (1) to 0, etc.
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const hour = date.getHours();
      
      if (hour >= 10 && hour <= 23) {
        const dayName = DAYS[adjustedDay];
        matrix[dayName][hour].count += 1;
        matrix[dayName][hour].impact += error.financial_impact || 0;
      }
    });

    return matrix;
  }, [orderErrors]);

  // Find max count for color scaling
  const maxCount = useMemo(() => {
    let max = 0;
    Object.values(heatmapData).forEach(hours => {
      Object.values(hours).forEach(cell => {
        if (cell.count > max) max = cell.count;
      });
    });
    return max || 1;
  }, [heatmapData]);

  const getColor = (count: number) => {
    if (count === 0) return "bg-muted/30";
    const intensity = count / maxCount;
    if (intensity < 0.25) return "bg-amber-200 dark:bg-amber-900/40";
    if (intensity < 0.5) return "bg-orange-300 dark:bg-orange-800/50";
    if (intensity < 0.75) return "bg-red-400 dark:bg-red-700/60";
    return "bg-red-600 dark:bg-red-600/80";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Heatmap Jour/Heure</CardTitle>
        <p className="text-sm text-muted-foreground">
          Visualisez les pics d'erreurs par créneau horaire
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header row with hours */}
            <div className="flex">
              <div className="w-12 shrink-0" />
              {HOURS.map(hour => (
                <div
                  key={hour}
                  className="flex-1 text-center text-xs text-muted-foreground font-medium py-1"
                >
                  {hour}h
                </div>
              ))}
            </div>

            {/* Data rows */}
            <TooltipProvider>
              {DAYS.map(day => (
                <div key={day} className="flex">
                  <div className="w-12 shrink-0 flex items-center text-xs font-medium text-muted-foreground">
                    {day}
                  </div>
                  {HOURS.map(hour => {
                    const cell = heatmapData[day]?.[hour] || { count: 0, impact: 0 };
                    return (
                      <Tooltip key={`${day}-${hour}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 aspect-square m-0.5 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${getColor(cell.count)}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <p className="font-medium">{day} {hour}h-{hour + 1}h</p>
                            <p>{cell.count} erreur{cell.count > 1 ? "s" : ""}</p>
                            <p className="text-destructive">{formatCurrency(cell.impact)}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </TooltipProvider>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <span className="text-xs text-muted-foreground">Moins</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-sm bg-muted/30" />
                <div className="w-4 h-4 rounded-sm bg-amber-200 dark:bg-amber-900/40" />
                <div className="w-4 h-4 rounded-sm bg-orange-300 dark:bg-orange-800/50" />
                <div className="w-4 h-4 rounded-sm bg-red-400 dark:bg-red-700/60" />
                <div className="w-4 h-4 rounded-sm bg-red-600 dark:bg-red-600/80" />
              </div>
              <span className="text-xs text-muted-foreground">Plus</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
