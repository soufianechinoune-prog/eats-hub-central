import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayStats {
  day: string;
  dayIndex: number;
  avgRating: number;
  count: number;
}

interface ReviewsHeatmapProps {
  data: DayStats[];
}

export function ReviewsHeatmap({ data }: ReviewsHeatmapProps) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const bestDay = data.reduce((best, current) => 
    current.avgRating > best.avgRating ? current : best
  , data[0]);
  const worstDay = data.reduce((worst, current) => 
    current.avgRating < worst.avgRating && current.count > 0 ? current : worst
  , data[0]);

  const getRatingColor = (rating: number) => {
    if (rating === 0) return "bg-muted/50";
    if (rating >= 4.5) return "bg-emerald-500";
    if (rating >= 4.0) return "bg-emerald-400";
    if (rating >= 3.5) return "bg-amber-400";
    if (rating >= 3.0) return "bg-amber-500";
    return "bg-red-500";
  };

  const getRatingTextColor = (rating: number) => {
    if (rating === 0) return "text-muted-foreground";
    if (rating >= 3.5) return "text-white";
    return "text-white";
  };

  return (
    <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-purple-500" />
          Performance par Jour
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Grille des jours */}
        <div className="grid grid-cols-7 gap-2 mb-6">
          {data.map((day) => (
            <div key={day.day} className="text-center">
              <div className="text-xs text-muted-foreground mb-2 font-medium">
                {day.day}
              </div>
              <div 
                className={cn(
                  "aspect-square rounded-lg flex flex-col items-center justify-center transition-all hover:scale-105",
                  getRatingColor(day.avgRating),
                  day.avgRating > 0 && "shadow-md"
                )}
              >
                <span className={cn("text-lg font-bold", getRatingTextColor(day.avgRating))}>
                  {day.avgRating > 0 ? day.avgRating.toFixed(1) : "-"}
                </span>
                <span className={cn("text-[10px] opacity-75", getRatingTextColor(day.avgRating))}>
                  {day.count} avis
                </span>
              </div>
              {/* Barre de volume */}
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500/60 rounded-full transition-all"
                  style={{ width: `${(day.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Insights */}
        <div className="flex gap-4 pt-4 border-t border-border/50">
          {bestDay && bestDay.count > 0 && (
            <div className="flex-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-500">Meilleur jour</span>
              </div>
              <div className="text-lg font-bold">{bestDay.day}</div>
              <div className="text-sm text-muted-foreground">
                Note moyenne: {bestDay.avgRating.toFixed(2)}
              </div>
            </div>
          )}
          {worstDay && worstDay.count > 0 && worstDay.day !== bestDay?.day && (
            <div className="flex-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-amber-500">À surveiller</span>
              </div>
              <div className="text-lg font-bold">{worstDay.day}</div>
              <div className="text-sm text-muted-foreground">
                Note moyenne: {worstDay.avgRating.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Légende */}
        <div className="flex justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-muted-foreground">≥4.5</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-400" />
            <span className="text-muted-foreground">4.0-4.5</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-400" />
            <span className="text-muted-foreground">3.5-4.0</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span className="text-muted-foreground">3.0-3.5</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-muted-foreground">&lt;3.0</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
