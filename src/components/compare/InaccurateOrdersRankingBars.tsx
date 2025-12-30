import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { extractCityName } from "@/lib/restaurantUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RestaurantStat {
  id: string;
  name: string;
  errorRate: number;
  errorCount: number;
  orderCount: number;
  totalFinancialImpact: number;
}

interface InaccurateOrdersRankingBarsProps {
  stats: RestaurantStat[];
}

const getMedal = (index: number): string => {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "";
};

const getBarColor = (errorRate: number): string => {
  if (errorRate <= 1) return "bg-emerald-500";
  if (errorRate <= 2) return "bg-emerald-400";
  if (errorRate <= 3) return "bg-amber-400";
  if (errorRate <= 5) return "bg-orange-400";
  return "bg-red-500";
};

const getStatusLabel = (errorRate: number): { text: string; color: string } => {
  if (errorRate <= 1) return { text: "Excellent", color: "text-emerald-500" };
  if (errorRate <= 2) return { text: "Très bien", color: "text-emerald-400" };
  if (errorRate <= 3) return { text: "Bon", color: "text-amber-500" };
  if (errorRate <= 5) return { text: "À surveiller", color: "text-orange-500" };
  return { text: "Critique", color: "text-red-500" };
};

export const InaccurateOrdersRankingBars = ({ stats }: InaccurateOrdersRankingBarsProps) => {
  const navigate = useNavigate();
  const { toggleRestaurantSelection, setSelectedMonth, setSelectedYear, setPeriodMode } = useAnalyticsContext();
  
  // Sort by error rate (lowest first = best)
  const sortedStats = [...stats].sort((a, b) => a.errorRate - b.errorRate);
  const maxErrorRate = Math.max(...sortedStats.map(s => s.errorRate), 1);

  const handleRestaurantClick = (restaurantId: string) => {
    toggleRestaurantSelection(restaurantId);
    // Navigate to Operations Analytics with orderErrors tab, preserving current period context
    navigate("/analytics/operations?tab=orderErrors");
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
        // Direct proportion: longer bar = higher error rate
        const barWidth = (stat.errorRate / maxErrorRate) * 100;
        const status = getStatusLabel(stat.errorRate);
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
                <span className="font-semibold tabular-nums min-w-[60px] text-right">
                  {stat.errorRate.toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(barWidth, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                className={cn("h-full rounded-full", getBarColor(stat.errorRate))}
              />
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stat.errorCount} erreurs / {stat.orderCount.toLocaleString('fr-FR')} commandes</span>
              {stat.errorRate <= 2 && (
                <span className="text-emerald-500">✓ Performance top</span>
              )}
              {stat.totalFinancialImpact > 0 && (
                <span className="text-orange-500">-{stat.totalFinancialImpact.toFixed(0)}€</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
