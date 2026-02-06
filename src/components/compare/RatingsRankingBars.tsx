import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { extractCityName } from "@/lib/restaurantUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Star, TrendingUp, TrendingDown } from "lucide-react";

interface RestaurantRatingStat {
  id: string;
  name: string;
  avgRating: number;
  totalReviews: number;
}

interface RatingsRankingBarsProps {
  stats: RestaurantRatingStat[];
  dateRange: { start: Date; end: Date };
  showTop?: number;
  showBottom?: number;
}

const getMedal = (index: number): string => {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "";
};

const getBarColor = (rating: number): string => {
  if (rating >= 4.8) return "bg-emerald-500";
  if (rating >= 4.5) return "bg-emerald-400";
  if (rating >= 4.2) return "bg-amber-400";
  if (rating >= 4.0) return "bg-orange-400";
  return "bg-red-500";
};

const getStatusLabel = (rating: number): { text: string; color: string } => {
  if (rating >= 4.8) return { text: "Excellent", color: "text-emerald-500" };
  if (rating >= 4.5) return { text: "Très bien", color: "text-emerald-400" };
  if (rating >= 4.2) return { text: "Bien", color: "text-amber-500" };
  if (rating >= 4.0) return { text: "Correct", color: "text-orange-500" };
  return { text: "À améliorer", color: "text-red-500" };
};

export const RatingsRankingBars = ({ 
  stats, 
  dateRange, 
  showTop = 10,
  showBottom = 5 
}: RatingsRankingBarsProps) => {
  const navigate = useNavigate();
  const { 
    setSelectedRestaurants, 
    setVisibleRestaurants,
    setPeriodMode, 
    setDateRange: setContextDateRange 
  } = useAnalyticsContext();
  
  // Sort by rating (best first)
  const sortedStats = [...stats].sort((a, b) => b.avgRating - a.avgRating);
  
  // Top performers
  const topStats = sortedStats.slice(0, showTop);
  // Bottom performers (exclude those already in top)
  const bottomStats = sortedStats.slice(-showBottom).filter(s => !topStats.includes(s));
  
  // Calculate bar widths (relative to 5.0)
  const minRating = 3.5; // Baseline for visual
  const maxRating = 5.0;

  const handleRestaurantClick = (restaurantId: string) => {
    setVisibleRestaurants([restaurantId]);
    setSelectedRestaurants([restaurantId]);
    setPeriodMode("range");
    setContextDateRange({ from: dateRange.start, to: dateRange.end });
    
    const currentState = localStorage.getItem("analytics-context");
    const state = currentState ? JSON.parse(currentState) : {};
    const updatedState = {
      ...state,
      selectedRestaurants: [restaurantId],
      visibleRestaurants: [restaurantId],
      periodMode: "range",
      dateRange: {
        from: dateRange.start.toISOString(),
        to: dateRange.end.toISOString(),
      },
    };
    localStorage.setItem("analytics-context", JSON.stringify(updatedState));
    
    navigate("/analytics/reviews");
  };

  if (sortedStats.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Aucune donnée disponible
      </div>
    );
  }

  const renderBar = (stat: RestaurantRatingStat, index: number, isTop: boolean) => {
    const barWidth = ((stat.avgRating - minRating) / (maxRating - minRating)) * 100;
    const status = getStatusLabel(stat.avgRating);
    const cityName = extractCityName(stat.name);
    const globalRank = isTop ? index + 1 : sortedStats.length - bottomStats.length + index + 1;
    
    return (
      <motion.div
        key={stat.id}
        initial={{ opacity: 0, x: isTop ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="space-y-1.5 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2"
        onClick={() => handleRestaurantClick(stat.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground w-6">
              {isTop && index < 3 ? getMedal(index) : `#${globalRank}`}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium hover:text-primary transition-colors truncate max-w-[150px]">
                  {cityName}
                </span>
              </TooltipTrigger>
              <TooltipContent>{stat.name}</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-xs font-medium", status.color)}>
              {status.text}
            </span>
            <span className="font-bold tabular-nums min-w-[50px] text-right flex items-center justify-end gap-1">
              <Star className={cn(
                "h-3.5 w-3.5",
                stat.avgRating >= 4.5 ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground"
              )} />
              {stat.avgRating.toFixed(2)}
            </span>
          </div>
        </div>
        
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(Math.min(barWidth, 100), 5)}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.05 }}
            className={cn("h-full rounded-full", getBarColor(stat.avgRating))}
          />
        </div>
        
        <div className="text-xs text-muted-foreground">
          {stat.totalReviews.toLocaleString('fr-FR')} avis
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Performers */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="h-4 w-4" />
          Top {topStats.length} restaurants
        </div>
        <div className="space-y-1">
          {topStats.map((stat, idx) => renderBar(stat, idx, true))}
        </div>
      </div>

      {/* Separator */}
      {bottomStats.length > 0 && (
        <div className="border-t border-border/50 pt-4">
          {/* Bottom Performers */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
              <TrendingDown className="h-4 w-4" />
              Restaurants à surveiller
            </div>
            <div className="space-y-1">
              {bottomStats.map((stat, idx) => renderBar(stat, idx, false))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
