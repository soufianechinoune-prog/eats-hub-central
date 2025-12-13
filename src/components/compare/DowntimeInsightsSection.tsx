import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, TrendingDown, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { extractCityName } from "@/lib/restaurantUtils";

interface RestaurantStat {
  id: string;
  name: string;
  totalOfflineMinutes: number;
  availabilityRate: number;
  hourlyData: Record<number, number>;
  weekdayData: Record<number, number>;
}

interface DowntimeInsightsSectionProps {
  stats: RestaurantStat[];
  period: string;
}

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export const DowntimeInsightsSection = ({ stats }: DowntimeInsightsSectionProps) => {
  if (stats.length === 0) return null;

  // Find restaurant with best performance (least downtime)
  const bestPerformer = stats[0];
  
  // Find restaurant with worst performance
  const worstPerformer = stats[stats.length - 1];
  
  // Calculate gap between best and worst
  const gap = worstPerformer.totalOfflineMinutes - bestPerformer.totalOfflineMinutes;
  
  // Find peak inactivity hour across all restaurants
  const hourlyTotals: Record<number, number> = {};
  stats.forEach(stat => {
    Object.entries(stat.hourlyData).forEach(([hour, minutes]) => {
      hourlyTotals[Number(hour)] = (hourlyTotals[Number(hour)] || 0) + minutes;
    });
  });
  const peakHour = Object.entries(hourlyTotals).sort((a, b) => b[1] - a[1])[0];
  
  // Find worst day of week
  const weekdayTotals: Record<number, number> = {};
  stats.forEach(stat => {
    Object.entries(stat.weekdayData).forEach(([day, minutes]) => {
      weekdayTotals[Number(day)] = (weekdayTotals[Number(day)] || 0) + minutes;
    });
  });
  const peakWeekday = Object.entries(weekdayTotals).sort((a, b) => b[1] - a[1])[0];

  // Check if any restaurant has 100% availability
  const perfectRestaurants = stats.filter(s => s.totalOfflineMinutes === 0);

  const insights = [
    // Best performer
    {
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      title: "Meilleur performer",
      value: extractCityName(bestPerformer.name),
      detail: bestPerformer.totalOfflineMinutes === 0 
        ? "100% disponible" 
        : `Seulement ${formatMinutesToDisplay(bestPerformer.totalOfflineMinutes)} d'inactivité`,
    },
    // Worst performer (if different from best)
    worstPerformer.id !== bestPerformer.id && {
      icon: AlertTriangle,
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      title: "À surveiller",
      value: extractCityName(worstPerformer.name),
      detail: `${formatMinutesToDisplay(worstPerformer.totalOfflineMinutes)} d'inactivité`,
    },
    // Gap between best and worst
    gap > 0 && {
      icon: BarChart3,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      title: "Écart max",
      value: formatMinutesToDisplay(gap),
      detail: `Entre ${extractCityName(bestPerformer.name)} et ${extractCityName(worstPerformer.name)}`,
    },
    // Peak hour
    peakHour && Number(peakHour[1]) > 0 && {
      icon: TrendingDown,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      title: "Heure critique",
      value: `${peakHour[0]}h - ${Number(peakHour[0]) + 1}h`,
      detail: `${formatMinutesToDisplay(Number(peakHour[1]))} total sur le réseau`,
    },
    // Peak weekday
    peakWeekday && Number(peakWeekday[1]) > 0 && {
      icon: TrendingDown,
      iconColor: "text-violet-500",
      bgColor: "bg-violet-500/10",
      borderColor: "border-violet-500/20",
      title: "Jour critique",
      value: WEEKDAYS[Number(peakWeekday[0])],
      detail: `${formatMinutesToDisplay(Number(peakWeekday[1]))} total`,
    },
    // Perfect restaurants
    perfectRestaurants.length > 0 && perfectRestaurants.length < stats.length && {
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      title: "100% disponible",
      value: `${perfectRestaurants.length} restaurant${perfectRestaurants.length > 1 ? "s" : ""}`,
      detail: perfectRestaurants.map(r => extractCityName(r.name)).join(", "),
    },
  ].filter(Boolean);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {insights.map((insight, index) => {
        if (!insight) return null;
        const Icon = insight.icon;
        
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={cn(
              "backdrop-blur-xl bg-card/80 border shadow-md h-full",
              insight.borderColor
            )}>
              <CardContent className="p-4 space-y-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", insight.bgColor)}>
                  <Icon className={cn("h-4 w-4", insight.iconColor)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{insight.title}</p>
                  <p className="font-semibold truncate">{insight.value}</p>
                  <p className="text-xs text-muted-foreground truncate">{insight.detail}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
