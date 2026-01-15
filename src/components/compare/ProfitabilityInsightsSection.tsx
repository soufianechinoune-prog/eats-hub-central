import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle, Award, Target, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface RestaurantStats {
  id: string;
  name: string;
  profitability: number;
  totalSales: number;
  totalPayout: number;
  totalOrders: number;
  uberFeeRate: number;
  promoRate: number;
  refundRate: number;
}

interface ProfitabilityInsightsSectionProps {
  stats: RestaurantStats[];
  period: "week" | "month" | "quarter";
}

export const ProfitabilityInsightsSection = ({ stats, period }: ProfitabilityInsightsSectionProps) => {
  const insights = useMemo(() => {
    if (!stats.length) return null;

    // Best performer
    const bestPerformer = stats[0];
    // Worst performer
    const worstPerformer = stats[stats.length - 1];
    
    // Average profitability
    const avgProfitability = stats.reduce((sum, s) => sum + s.profitability, 0) / stats.length;
    
    // Spread between best and worst
    const spread = bestPerformer.profitability - worstPerformer.profitability;
    
    // Count restaurants above/below average
    const aboveAvg = stats.filter(s => s.profitability >= avgProfitability).length;
    const belowAvg = stats.length - aboveAvg;
    
    // Total network values
    const totalSales = stats.reduce((sum, s) => sum + s.totalSales, 0);
    const totalPayout = stats.reduce((sum, s) => sum + s.totalPayout, 0);
    const networkProfitability = totalSales > 0 ? (totalPayout / totalSales) * 100 : 0;

    return {
      bestPerformer,
      worstPerformer,
      avgProfitability,
      networkProfitability,
      spread,
      aboveAvg,
      belowAvg,
      totalSales,
      totalPayout,
    };
  }, [stats]);

  if (!insights) return null;

  const periodLabel = period === "week" ? "cette semaine" : period === "month" ? "ce mois" : "ce trimestre";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Network Profitability */}
      <Card className="backdrop-blur-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rentabilité réseau</p>
              <p className="text-2xl font-bold text-emerald-600">
                {insights.networkProfitability.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sur {(insights.totalSales / 1000).toFixed(0)}k€ de CA {periodLabel}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Percent className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Performer */}
      <Card className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Meilleure rentabilité</p>
              <p className="text-lg font-semibold truncate max-w-[180px]">
                {insights.bestPerformer.name}
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {insights.bestPerformer.profitability.toFixed(1)}%
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Award className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worst Performer */}
      <Card className={cn(
        "backdrop-blur-xl border-border/50",
        insights.worstPerformer.profitability < 60 
          ? "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20"
          : "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">À améliorer</p>
              <p className="text-lg font-semibold truncate max-w-[180px]">
                {insights.worstPerformer.name}
              </p>
              <p className={cn(
                "text-2xl font-bold",
                insights.worstPerformer.profitability < 60 ? "text-red-600" : "text-amber-600"
              )}>
                {insights.worstPerformer.profitability.toFixed(1)}%
              </p>
            </div>
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              insights.worstPerformer.profitability < 60 ? "bg-red-500/20" : "bg-amber-500/20"
            )}>
              <TrendingDown className={cn(
                "h-5 w-5",
                insights.worstPerformer.profitability < 60 ? "text-red-600" : "text-amber-600"
              )} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Spread Analysis */}
      <Card className={cn(
        "backdrop-blur-xl border-border/50",
        insights.spread > 10 
          ? "bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20"
          : "bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Écart max</p>
              <p className={cn(
                "text-2xl font-bold",
                insights.spread > 10 ? "text-orange-600" : "text-green-600"
              )}>
                {insights.spread.toFixed(1)} pts
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {insights.aboveAvg} au-dessus de la moyenne
              </p>
            </div>
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              insights.spread > 10 ? "bg-orange-500/20" : "bg-green-500/20"
            )}>
              <Target className={cn(
                "h-5 w-5",
                insights.spread > 10 ? "text-orange-600" : "text-green-600"
              )} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
