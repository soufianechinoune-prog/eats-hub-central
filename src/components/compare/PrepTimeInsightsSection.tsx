import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, TrendingUp, BarChart3, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { extractCityName } from "@/lib/restaurantUtils";

interface RestaurantStat {
  id: string;
  name: string;
  avgPrepTime: number;
  orderCount: number;
  hourlyData: Record<number, { total: number; count: number }>;
  weekdayData: Record<number, { total: number; count: number }>;
}

interface PrepTimeInsightsSectionProps {
  stats: RestaurantStat[];
  period: string;
}

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const totalSeconds = Math.round(minutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (s === 0) return `${m}min`;
  return `${m}min ${s}s`;
};

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export const PrepTimeInsightsSection = ({ stats }: PrepTimeInsightsSectionProps) => {
  if (stats.length === 0) return null;

  // Find restaurant with best performance (shortest prep time)
  const sortedBySpeed = [...stats].sort((a, b) => a.avgPrepTime - b.avgPrepTime);
  const bestPerformer = sortedBySpeed[0];
  const worstPerformer = sortedBySpeed[sortedBySpeed.length - 1];
  
  // Calculate gap between best and worst
  const gap = worstPerformer.avgPrepTime - bestPerformer.avgPrepTime;
  
  // Calculate network average
  const totalWeighted = stats.reduce((sum, s) => sum + s.avgPrepTime * s.orderCount, 0);
  const totalOrders = stats.reduce((sum, s) => sum + s.orderCount, 0);
  const networkAverage = totalOrders > 0 ? totalWeighted / totalOrders : 0;
  
  // Find peak hour across all restaurants
  const hourlyTotals: Record<number, { total: number; count: number }> = {};
  stats.forEach(stat => {
    Object.entries(stat.hourlyData).forEach(([hour, data]) => {
      if (!hourlyTotals[Number(hour)]) {
        hourlyTotals[Number(hour)] = { total: 0, count: 0 };
      }
      hourlyTotals[Number(hour)].total += data.total;
      hourlyTotals[Number(hour)].count += data.count;
    });
  });
  const peakHour = Object.entries(hourlyTotals)
    .filter(([, data]) => data.count > 0)
    .map(([hour, data]) => ({ hour: Number(hour), avg: data.total / data.count }))
    .sort((a, b) => b.avg - a.avg)[0];
  
  // Find worst day of week
  const weekdayTotals: Record<number, { total: number; count: number }> = {};
  stats.forEach(stat => {
    Object.entries(stat.weekdayData).forEach(([day, data]) => {
      if (!weekdayTotals[Number(day)]) {
        weekdayTotals[Number(day)] = { total: 0, count: 0 };
      }
      weekdayTotals[Number(day)].total += data.total;
      weekdayTotals[Number(day)].count += data.count;
    });
  });
  const peakWeekday = Object.entries(weekdayTotals)
    .filter(([, data]) => data.count > 0)
    .map(([day, data]) => ({ day: Number(day), avg: data.total / data.count }))
    .sort((a, b) => b.avg - a.avg)[0];

  // Fast restaurants (under 5 min)
  const fastRestaurants = stats.filter(s => s.avgPrepTime < 5);

  const insights = [
    // Best performer
    {
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      title: "Plus rapide",
      value: extractCityName(bestPerformer.name),
      detail: `${formatMinutesToDisplay(bestPerformer.avgPrepTime)} en moyenne`,
    },
    // Worst performer (if different from best)
    worstPerformer.id !== bestPerformer.id && {
      icon: AlertTriangle,
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      title: "Plus lent",
      value: extractCityName(worstPerformer.name),
      detail: `${formatMinutesToDisplay(worstPerformer.avgPrepTime)} en moyenne`,
    },
    // Network average
    networkAverage > 0 && {
      icon: BarChart3,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      title: "Moyenne réseau",
      value: formatMinutesToDisplay(networkAverage),
      detail: `Sur ${totalOrders.toLocaleString('fr-FR')} commandes`,
    },
    // Gap between best and worst
    gap > 0.5 && {
      icon: TrendingUp,
      iconColor: "text-violet-500",
      bgColor: "bg-violet-500/10",
      borderColor: "border-violet-500/20",
      title: "Écart max",
      value: formatMinutesToDisplay(gap),
      detail: `Entre ${extractCityName(bestPerformer.name)} et ${extractCityName(worstPerformer.name)}`,
    },
    // Peak hour
    peakHour && {
      icon: Clock,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      title: "Heure lente",
      value: `${peakHour.hour}h - ${peakHour.hour + 1}h`,
      detail: `${formatMinutesToDisplay(peakHour.avg)} en moyenne`,
    },
    // Peak weekday
    peakWeekday && {
      icon: Clock,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      title: "Jour lent",
      value: WEEKDAYS[peakWeekday.day],
      detail: `${formatMinutesToDisplay(peakWeekday.avg)} en moyenne`,
    },
    // Fast restaurants
    fastRestaurants.length > 0 && fastRestaurants.length < stats.length && {
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      title: "< 5 minutes",
      value: `${fastRestaurants.length} restaurant${fastRestaurants.length > 1 ? "s" : ""}`,
      detail: fastRestaurants.map(r => extractCityName(r.name)).join(", "),
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
