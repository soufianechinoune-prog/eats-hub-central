import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle, Award, Target, Percent, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsContext, ProfitabilityBase } from "@/contexts/AnalyticsContext";
import { Button } from "@/components/ui/button";

interface RestaurantStats {
  id: string;
  name: string;
  profitability: number; // Total encaissé (backward compat)
  margeUber: number; // What Uber pays / sales (primary metric)
  trBonus: number; // Meal voucher / sales
  totalSales: number;
  totalPayout: number;
  totalNetPayout: number;
  totalMealVoucher: number;
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
  const { profitabilityBase, setProfitabilityBase } = useAnalyticsContext();
  
  const insights = useMemo(() => {
    if (!stats.length) return null;

    // Best performer (by Marge Uber, primary metric)
    const bestPerformer = stats[0];
    // Worst performer
    const worstPerformer = stats[stats.length - 1];
    
    // Average Marge Uber (not total encaissé)
    const avgMargeUber = stats.reduce((sum, s) => sum + s.margeUber, 0) / stats.length;
    
    // Average TR Bonus
    const avgTrBonus = stats.reduce((sum, s) => sum + s.trBonus, 0) / stats.length;
    
    // Spread between best and worst (on Marge Uber)
    const spread = bestPerformer.margeUber - worstPerformer.margeUber;
    
    // Count restaurants above/below average
    const aboveAvg = stats.filter(s => s.margeUber >= avgMargeUber).length;
    const belowAvg = stats.length - aboveAvg;
    
    // Total network values
    const totalSales = stats.reduce((sum, s) => sum + s.totalSales, 0);
    const totalNetPayout = stats.reduce((sum, s) => sum + s.totalNetPayout, 0);
    const totalMealVoucher = stats.reduce((sum, s) => sum + s.totalMealVoucher, 0);
    const totalPromo = stats.reduce((sum, s) => sum + (s.totalSales * s.promoRate / 100), 0);
    
    // Network Marge Uber (without meal vouchers)
    const networkMargeUber = totalSales > 0 ? (totalNetPayout / totalSales) * 100 : 0;
    // Network TR Bonus
    const networkTrBonus = totalSales > 0 ? (totalMealVoucher / totalSales) * 100 : 0;
    
    // Marge économique (base nette = ventes - promos)
    const netSales = totalSales - totalPromo;
    const networkMargeEco = netSales > 0 ? (totalNetPayout / netSales) * 100 : 0;

    return {
      bestPerformer,
      worstPerformer,
      avgMargeUber,
      avgTrBonus,
      networkMargeUber,
      networkMargeEco,
      networkTrBonus,
      spread,
      aboveAvg,
      belowAvg,
      totalSales,
      totalNetPayout,
      totalMealVoucher,
      totalPromo,
      netSales,
    };
  }, [stats]);

  if (!insights) return null;

  const periodLabel = period === "week" ? "cette semaine" : period === "month" ? "ce mois" : "ce trimestre";

  // Calculate display values based on selected base
  const displayMargin = profitabilityBase === "net" ? insights.networkMargeEco : insights.networkMargeUber;
  const baseLabel = profitabilityBase === "net" ? "base nette" : "base brute";

  return (
    <div className="space-y-4">
      {/* Toggle for calculation base */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Base de calcul:</span>
        <div className="flex items-center rounded-lg border bg-muted/30 p-1">
          <Button
            variant={profitabilityBase === "gross" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setProfitabilityBase("gross")}
          >
            Ventes brutes
          </Button>
          <Button
            variant={profitabilityBase === "net" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setProfitabilityBase("net")}
          >
            Ventes nettes
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Network Marge Uber */}
        <Card className="backdrop-blur-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Marge Uber ({baseLabel})</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {displayMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-blue-600 font-medium mt-1">
                  +{insights.networkTrBonus.toFixed(1)}% TR
                </p>
                <p className="text-xs text-muted-foreground">
                  Sur {(insights.totalSales / 1000).toFixed(0)}k€ de CA {periodLabel}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Percent className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Marge Économique (NEW) */}
        <Card className="backdrop-blur-xl bg-gradient-to-br from-teal-500/10 to-teal-500/5 border-teal-500/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Marge économique</p>
                <p className="text-2xl font-bold text-teal-600">
                  {insights.networkMargeEco.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Net Payout / Ventes Nettes
                </p>
                <p className="text-xs text-muted-foreground">
                  Ventes nettes: {(insights.netSales / 1000).toFixed(0)}k€
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Best Performer */}
      <Card className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Meilleure marge</p>
              <p className="text-lg font-semibold truncate max-w-[180px]">
                {insights.bestPerformer.name}
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {insights.bestPerformer.margeUber.toFixed(1)}%
              </p>
              <p className="text-xs text-blue-600/70 font-medium">
                +{insights.bestPerformer.trBonus.toFixed(1)}% TR
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
        insights.worstPerformer.margeUber < 60 
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
                insights.worstPerformer.margeUber < 60 ? "text-red-600" : "text-amber-600"
              )}>
                {insights.worstPerformer.margeUber.toFixed(1)}%
              </p>
              <p className="text-xs text-blue-600/70 font-medium">
                +{insights.worstPerformer.trBonus.toFixed(1)}% TR
              </p>
            </div>
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              insights.worstPerformer.margeUber < 60 ? "bg-red-500/20" : "bg-amber-500/20"
            )}>
              <TrendingDown className={cn(
                "h-5 w-5",
                insights.worstPerformer.margeUber < 60 ? "text-red-600" : "text-amber-600"
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
    </div>
  );
};
