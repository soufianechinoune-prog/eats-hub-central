import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, TrendingUp, BarChart3, Clock, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { extractCityName } from "@/lib/restaurantUtils";

interface RestaurantStat {
  id: string;
  name: string;
  errorRate: number;
  errorCount: number;
  orderCount: number;
  totalFinancialImpact: number;
  hourlyData: Record<number, { errors: number; orders: number }>;
  weekdayData: Record<number, { errors: number; orders: number }>;
}

interface InaccurateOrdersInsightsSectionProps {
  stats: RestaurantStat[];
  period: string;
}

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export const InaccurateOrdersInsightsSection = ({ stats }: InaccurateOrdersInsightsSectionProps) => {
  if (stats.length === 0) return null;

  // Find restaurant with best performance (lowest error rate)
  const sortedByRate = [...stats].sort((a, b) => a.errorRate - b.errorRate);
  const bestPerformer = sortedByRate[0];
  const worstPerformer = sortedByRate[sortedByRate.length - 1];
  
  // Calculate gap between best and worst
  const gap = worstPerformer.errorRate - bestPerformer.errorRate;
  
  // Calculate network average
  const totalErrors = stats.reduce((sum, s) => sum + s.errorCount, 0);
  const totalOrders = stats.reduce((sum, s) => sum + s.orderCount, 0);
  const networkAverage = totalOrders > 0 ? (totalErrors / totalOrders) * 100 : 0;
  
  // Calculate total financial impact
  const totalFinancialImpact = stats.reduce((sum, s) => sum + s.totalFinancialImpact, 0);
  
  // Find peak hour across all restaurants
  const hourlyTotals: Record<number, { errors: number; orders: number }> = {};
  stats.forEach(stat => {
    Object.entries(stat.hourlyData).forEach(([hour, data]) => {
      if (!hourlyTotals[Number(hour)]) {
        hourlyTotals[Number(hour)] = { errors: 0, orders: 0 };
      }
      hourlyTotals[Number(hour)].errors += data.errors;
      hourlyTotals[Number(hour)].orders += data.orders;
    });
  });
  const peakHour = Object.entries(hourlyTotals)
    .filter(([, data]) => data.orders > 0)
    .map(([hour, data]) => ({ hour: Number(hour), rate: (data.errors / data.orders) * 100 }))
    .sort((a, b) => b.rate - a.rate)[0];
  
  // Find worst day of week
  const weekdayTotals: Record<number, { errors: number; orders: number }> = {};
  stats.forEach(stat => {
    Object.entries(stat.weekdayData).forEach(([day, data]) => {
      if (!weekdayTotals[Number(day)]) {
        weekdayTotals[Number(day)] = { errors: 0, orders: 0 };
      }
      weekdayTotals[Number(day)].errors += data.errors;
      weekdayTotals[Number(day)].orders += data.orders;
    });
  });
  const peakWeekday = Object.entries(weekdayTotals)
    .filter(([, data]) => data.orders > 0)
    .map(([day, data]) => ({ day: Number(day), rate: (data.errors / data.orders) * 100 }))
    .sort((a, b) => b.rate - a.rate)[0];

  // Excellent restaurants (under 2%)
  const excellentRestaurants = stats.filter(s => s.errorRate < 2);

  const insights = [
    // Best performer
    {
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      title: "Meilleur taux",
      value: extractCityName(bestPerformer.name),
      detail: `${bestPerformer.errorRate.toFixed(1)}% d'erreurs`,
    },
    // Worst performer (if different from best)
    worstPerformer.id !== bestPerformer.id && {
      icon: AlertTriangle,
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      title: "À améliorer",
      value: extractCityName(worstPerformer.name),
      detail: `${worstPerformer.errorRate.toFixed(1)}% d'erreurs`,
    },
    // Network average
    networkAverage > 0 && {
      icon: BarChart3,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      title: "Moyenne réseau",
      value: `${networkAverage.toFixed(1)}%`,
      detail: `${totalErrors} erreurs / ${totalOrders.toLocaleString('fr-FR')} commandes`,
    },
    // Total financial impact
    totalFinancialImpact > 0 && {
      icon: DollarSign,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      title: "Impact financier",
      value: `${totalFinancialImpact.toFixed(0)}€`,
      detail: `Remboursements sur la période`,
    },
    // Gap between best and worst
    gap > 0.5 && {
      icon: TrendingUp,
      iconColor: "text-violet-500",
      bgColor: "bg-violet-500/10",
      borderColor: "border-violet-500/20",
      title: "Écart max",
      value: `${gap.toFixed(1)}%`,
      detail: `Entre ${extractCityName(bestPerformer.name)} et ${extractCityName(worstPerformer.name)}`,
    },
    // Peak hour
    peakHour && {
      icon: Clock,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      title: "Heure critique",
      value: `${peakHour.hour}h - ${peakHour.hour + 1}h`,
      detail: `${peakHour.rate.toFixed(1)}% d'erreurs`,
    },
    // Peak weekday
    peakWeekday && {
      icon: Clock,
      iconColor: "text-red-400",
      bgColor: "bg-red-400/10",
      borderColor: "border-red-400/20",
      title: "Jour critique",
      value: WEEKDAYS[peakWeekday.day],
      detail: `${peakWeekday.rate.toFixed(1)}% d'erreurs`,
    },
    // Excellent restaurants
    excellentRestaurants.length > 0 && excellentRestaurants.length < stats.length && {
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      title: "< 2% d'erreurs",
      value: `${excellentRestaurants.length} restaurant${excellentRestaurants.length > 1 ? "s" : ""}`,
      detail: excellentRestaurants.map(r => extractCityName(r.name)).join(", "),
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
