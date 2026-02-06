import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, TrendingUp, BarChart3, Star, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { extractCityName } from "@/lib/restaurantUtils";

interface RestaurantRatingStat {
  id: string;
  name: string;
  avgRating: number;
  totalReviews: number;
}

interface RatingsInsightsSectionProps {
  stats: RestaurantRatingStat[];
  globalAvg: number;
  totalReviews: number;
}

export const RatingsInsightsSection = ({ stats, globalAvg, totalReviews }: RatingsInsightsSectionProps) => {
  if (stats.length === 0) return null;

  // Sort by rating
  const sortedByRating = [...stats].sort((a, b) => b.avgRating - a.avgRating);
  const bestPerformer = sortedByRating[0];
  const worstPerformer = sortedByRating[sortedByRating.length - 1];
  
  // Calculate gap
  const gap = bestPerformer.avgRating - worstPerformer.avgRating;
  
  // Restaurants above 4.8
  const excellentRestaurants = stats.filter(s => s.avgRating >= 4.8);
  
  // Restaurants below 4.5 (need attention)
  const attentionRestaurants = stats.filter(s => s.avgRating < 4.5);
  
  // Restaurant with most reviews
  const mostReviewed = [...stats].sort((a, b) => b.totalReviews - a.totalReviews)[0];

  const insights = [
    // Best performer
    {
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      title: "Meilleure note",
      value: extractCityName(bestPerformer.name),
      detail: `${bestPerformer.avgRating.toFixed(2)} ★ (${bestPerformer.totalReviews} avis)`,
    },
    // Worst performer (if significantly different)
    worstPerformer.id !== bestPerformer.id && gap > 0.2 && {
      icon: AlertTriangle,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      title: "Note la plus basse",
      value: extractCityName(worstPerformer.name),
      detail: `${worstPerformer.avgRating.toFixed(2)} ★ (${worstPerformer.totalReviews} avis)`,
    },
    // Network average
    globalAvg > 0 && {
      icon: BarChart3,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      title: "Moyenne réseau",
      value: `${globalAvg.toFixed(2)} ★`,
      detail: `Sur ${totalReviews.toLocaleString('fr-FR')} avis`,
    },
    // Gap between best and worst
    gap > 0.3 && {
      icon: TrendingUp,
      iconColor: "text-violet-500",
      bgColor: "bg-violet-500/10",
      borderColor: "border-violet-500/20",
      title: "Écart max",
      value: `${gap.toFixed(2)} pts`,
      detail: `Entre ${extractCityName(bestPerformer.name)} et ${extractCityName(worstPerformer.name)}`,
    },
    // Excellent restaurants (>= 4.8)
    excellentRestaurants.length > 0 && {
      icon: Star,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      title: "Excellence (≥4.8)",
      value: `${excellentRestaurants.length} restaurant${excellentRestaurants.length > 1 ? "s" : ""}`,
      detail: excellentRestaurants.slice(0, 3).map(r => extractCityName(r.name)).join(", ") + 
              (excellentRestaurants.length > 3 ? "..." : ""),
    },
    // Attention needed (<4.5)
    attentionRestaurants.length > 0 && {
      icon: AlertTriangle,
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      title: "Attention (<4.5)",
      value: `${attentionRestaurants.length} restaurant${attentionRestaurants.length > 1 ? "s" : ""}`,
      detail: attentionRestaurants.slice(0, 3).map(r => extractCityName(r.name)).join(", ") +
              (attentionRestaurants.length > 3 ? "..." : ""),
    },
    // Most reviewed
    mostReviewed && mostReviewed.totalReviews > 50 && {
      icon: Users,
      iconColor: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/20",
      title: "Plus commenté",
      value: extractCityName(mostReviewed.name),
      detail: `${mostReviewed.totalReviews.toLocaleString('fr-FR')} avis`,
    },
  ].filter(Boolean);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {insights.map((insight, index) => {
        if (!insight) return null;
        const Icon = insight.icon;
        
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <Card className={cn(
              "backdrop-blur-xl bg-card/80 border shadow-md h-full",
              insight.borderColor
            )}>
              <CardContent className="p-3 space-y-1.5">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", insight.bgColor)}>
                  <Icon className={cn("h-3.5 w-3.5", insight.iconColor)} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{insight.title}</p>
                  <p className="font-semibold text-sm truncate">{insight.value}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{insight.detail}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
