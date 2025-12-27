import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { extractCityName } from "@/lib/restaurantUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RestaurantStat {
  id: string;
  name: string;
  avgPrepTime: number;
  orderCount: number;
}

interface PrepTimeRankingBarsProps {
  stats: RestaurantStat[];
}

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const totalSeconds = Math.round(minutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (s === 0) return `${m}min`;
  return `${m}min ${s}s`;
};

const getMedal = (index: number): string => {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "";
};

const getBarColor = (prepTime: number): string => {
  if (prepTime <= 4) return "bg-emerald-500";
  if (prepTime <= 5) return "bg-emerald-400";
  if (prepTime <= 6) return "bg-amber-400";
  if (prepTime <= 8) return "bg-orange-400";
  return "bg-red-500";
};

const getStatusLabel = (prepTime: number): { text: string; color: string } => {
  if (prepTime <= 4) return { text: "Excellent", color: "text-emerald-500" };
  if (prepTime <= 5) return { text: "Très bien", color: "text-emerald-400" };
  if (prepTime <= 6) return { text: "Bon", color: "text-amber-500" };
  if (prepTime <= 8) return { text: "À surveiller", color: "text-orange-500" };
  return { text: "Lent", color: "text-red-500" };
};

export const PrepTimeRankingBars = ({ stats }: PrepTimeRankingBarsProps) => {
  const navigate = useNavigate();
  const { toggleRestaurantSelection, setSelectedMonth, setSelectedYear, setPeriodMode } = useAnalyticsContext();
  
  // Sort by prep time (fastest first)
  const sortedStats = [...stats].sort((a, b) => a.avgPrepTime - b.avgPrepTime);
  const maxPrepTime = Math.max(...sortedStats.map(s => s.avgPrepTime), 1);

  const handleRestaurantClick = (restaurantId: string) => {
    toggleRestaurantSelection(restaurantId);
    setPeriodMode("month");
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedYear(new Date().getFullYear());
    navigate("/analytics/operations");
  };

  if (sortedStats.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedStats.map((stat, index) => {
        // Direct proportion: longer bar = longer prep time
        const barWidth = (stat.avgPrepTime / maxPrepTime) * 100;
        const status = getStatusLabel(stat.avgPrepTime);
        const cityName = extractCityName(stat.name);
        
        return (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2"
            onClick={() => handleRestaurantClick(stat.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg w-6">{getMedal(index)}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium hover:text-primary transition-colors">{cityName}</span>
                  </TooltipTrigger>
                  <TooltipContent>{stat.name}</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-medium", status.color)}>
                  {status.text}
                </span>
                <span className="font-semibold tabular-nums min-w-[80px] text-right">
                  {formatMinutesToDisplay(stat.avgPrepTime)}
                </span>
              </div>
            </div>
            
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(barWidth, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                className={cn("h-full rounded-full", getBarColor(stat.avgPrepTime))}
              />
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stat.orderCount.toLocaleString('fr-FR')} commandes</span>
              {stat.avgPrepTime <= 4 && (
                <span className="text-emerald-500">✓ Performance top</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
