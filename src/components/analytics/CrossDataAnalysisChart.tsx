import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Percent, Gift, Euro, Info, TrendingUp, TrendingDown, Crown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

interface DailyData {
  date: string;
  sales_incl_vat: number;
  promo_incl_vat: number;
  net_payout?: number;
  meal_voucher_amount?: number;
  order_count?: number;
}

export interface UberOneChartData {
  date: string;
  uberOnePercent: number;
  uberOneCount: number;
  totalOrders: number;
}

interface CrossDataAnalysisChartProps {
  data: DailyData[];
  previousData?: DailyData[];
  granularity: "daily" | "weekly" | "monthly";
  isLoading?: boolean;
  uberOneData?: UberOneChartData[];
}

type MetricKey = "revenue" | "promos" | "profitability" | "uberOne" | "payout";

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; icon: typeof Euro }> = {
  revenue: { label: "CA", color: "hsl(var(--primary))", icon: Euro },
  promos: { label: "Promos", color: "hsl(25, 95%, 53%)", icon: Gift },
  profitability: { label: "Rentabilité", color: "hsl(142, 76%, 36%)", icon: Percent },
  uberOne: { label: "Uber One", color: "hsl(270, 70%, 55%)", icon: Crown },
  payout: { label: "Versement", color: "hsl(200, 80%, 50%)", icon: Wallet },
};

const CHART_ANIMATION_DURATION = 500;
const CHART_ANIMATION_EASING = "ease-out";

export function CrossDataAnalysisChart({
  data,
  previousData,
  granularity,
  isLoading = false,
  uberOneData,
}: CrossDataAnalysisChartProps) {
  const { profitabilityBase } = useAnalyticsContext();
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricKey>>(
    new Set(["revenue", "promos", "profitability"])
  );

  const toggleMetric = (metric: MetricKey) => {
    setVisibleMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metric)) {
        // Don't allow removing all metrics
        if (next.size > 1) {
          next.delete(metric);
        }
      } else {
        next.add(metric);
      }
      return next;
    });
  };

  // Aggregate data based on granularity
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const aggregated: Record<string, { 
      label: string;
      sortKey: string;
      revenue: number;
      promos: number;
      netPayout: number;
      mealVoucher: number;
      payout: number;
      profitability: number;
      orders: number;
      uberOnePercent: number;
      uberOneCount: number;
      uberOneTotalOrders: number;
    }> = {};

    data.forEach((item) => {
      const date = parseISO(item.date);
      let key: string;
      let label: string;
      let sortKey: string;

      if (granularity === "daily") {
        key = item.date;
        label = format(date, "dd MMM", { locale: fr });
        sortKey = item.date;
      } else if (granularity === "weekly") {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        key = format(weekStart, "yyyy-MM-dd");
        label = `S${format(weekStart, "w")}`;
        sortKey = key;
      } else {
        const monthStart = startOfMonth(date);
        key = format(monthStart, "yyyy-MM");
        label = format(date, "MMM", { locale: fr });
        sortKey = key;
      }

      if (!aggregated[key]) {
        aggregated[key] = { 
          label, 
          sortKey,
          revenue: 0, 
          promos: 0, 
          netPayout: 0, 
          mealVoucher: 0,
          payout: 0,
          profitability: 0,
          orders: 0,
          uberOnePercent: 0,
          uberOneCount: 0,
          uberOneTotalOrders: 0,
        };
      }
      
      aggregated[key].revenue += item.sales_incl_vat || 0;
      aggregated[key].promos += Math.abs(item.promo_incl_vat || 0);
      aggregated[key].netPayout += item.net_payout || 0;
      aggregated[key].mealVoucher += item.meal_voucher_amount || 0;
      aggregated[key].orders += item.order_count || 1;
    });

    // Calculate profitability and payout for each period
    Object.values(aggregated).forEach((item) => {
      const payoutAmount = item.netPayout + item.mealVoucher;
      item.payout = payoutAmount;
      // Use profitabilityBase from context
      const base = profitabilityBase === "net" 
        ? item.revenue - item.promos  // CA effectif (Net)
        : item.revenue;               // CA déclaré (Brut)
      
      item.profitability = base > 0 ? (payoutAmount / base) * 100 : 0;
    });

    // Merge Uber One data
    if (uberOneData && uberOneData.length > 0) {
      uberOneData.forEach((u1) => {
        // Find matching key based on granularity
        let matchKey: string;
        if (granularity === "daily") {
          matchKey = u1.date;
        } else if (granularity === "weekly") {
          const date = parseISO(u1.date + (u1.date.length === 7 ? "-01" : ""));
          const weekStart = startOfWeek(date, { weekStartsOn: 1 });
          matchKey = format(weekStart, "yyyy-MM-dd");
        } else {
          // Monthly: date is YYYY-MM
          matchKey = u1.date.length === 7 ? u1.date : u1.date.slice(0, 7);
        }

        if (aggregated[matchKey]) {
          aggregated[matchKey].uberOnePercent = u1.uberOnePercent;
          aggregated[matchKey].uberOneCount = u1.uberOneCount;
          aggregated[matchKey].uberOneTotalOrders = u1.totalOrders;
        }
      });
    }

    return Object.values(aggregated).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [data, granularity, profitabilityBase, uberOneData]);

  // Calculate dynamic Y-axis bounds for percentage metrics (profitability + uberOne)
  const percentageDomain = useMemo(() => {
    if (!chartData.length) return [0, 100];
    
    const profitValues = chartData.map(d => d.profitability).filter(v => v > 0);
    const u1Values = chartData.map(d => d.uberOnePercent).filter(v => v > 0);
    const allValues = [...profitValues, ...u1Values];
    
    if (!allValues.length) return [0, 100];
    
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // Round to nearest 10 with 5-point margin
    const lowerBound = Math.max(0, Math.floor((min - 5) / 10) * 10);
    const upperBound = Math.min(100, Math.ceil((max + 5) / 10) * 10);
    
    return [lowerBound, upperBound];
  }, [chartData]);

  // Calculate insights
  const insights = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalPromos = chartData.reduce((sum, d) => sum + d.promos, 0);
    const totalPayout = chartData.reduce((sum, d) => sum + d.payout, 0);
    const avgProfitability = chartData.reduce((sum, d) => sum + d.profitability, 0) / chartData.length;
    const promoImpact = totalRevenue > 0 ? (totalPromos / totalRevenue) * 100 : 0;

    // Find correlation between promos and profitability
    const highPromoPoints = chartData.filter(d => d.promos > totalPromos / chartData.length);
    const avgProfitHighPromo = highPromoPoints.length > 0
      ? highPromoPoints.reduce((sum, d) => sum + d.profitability, 0) / highPromoPoints.length
      : 0;
    
    const lowPromoPoints = chartData.filter(d => d.promos <= totalPromos / chartData.length);
    const avgProfitLowPromo = lowPromoPoints.length > 0
      ? lowPromoPoints.reduce((sum, d) => sum + d.profitability, 0) / lowPromoPoints.length
      : 0;

    const profitDelta = avgProfitHighPromo - avgProfitLowPromo;

    // Calculate average Uber One %
    const u1Points = chartData.filter(d => d.uberOnePercent > 0);
    const avgUberOnePercent = u1Points.length > 0
      ? u1Points.reduce((sum, d) => sum + d.uberOnePercent, 0) / u1Points.length
      : 0;

    return {
      totalRevenue,
      totalPromos,
      totalPayout,
      avgProfitability,
      promoImpact,
      profitDelta,
      avgUberOnePercent,
    };
  }, [chartData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analyse Croisée CA / Promos / Rentabilité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analyse Croisée CA / Promos / Rentabilité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            Aucune donnée sur cette période
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analyse Croisée CA / Promos / Rentabilité
            </CardTitle>

            {/* Metric toggles */}
            <div className="flex items-center gap-2">
              {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((metric) => {
                const config = METRIC_CONFIG[metric];
                const isActive = visibleMetrics.has(metric);
                const Icon = config.icon;
                
                return (
                  <Button
                    key={metric}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleMetric(metric)}
                    className={cn(
                      "gap-1.5 transition-all",
                      isActive && "shadow-md"
                    )}
                    style={{
                      backgroundColor: isActive ? config.color : undefined,
                      borderColor: isActive ? config.color : undefined,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Insights bar */}
          {insights && (
            <div className="bg-muted/50 rounded-lg p-3 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">Insight :</span>
              </div>
              <Badge variant="outline" className="gap-1">
                <Gift className="h-3 w-3 text-orange-500" />
                Promos = {insights.promoImpact.toFixed(1)}% du CA
              </Badge>
              <Badge 
                variant={insights.profitDelta < 0 ? "destructive" : "secondary"}
                className="gap-1"
              >
                {insights.profitDelta < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <TrendingUp className="h-3 w-3" />
                )}
                {insights.profitDelta < 0 ? "" : "+"}
                {insights.profitDelta.toFixed(1)} pts rentab. avec fortes promos
              </Badge>
              {insights.avgUberOnePercent > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Crown className="h-3 w-3 text-purple-500" />
                  Moy. Uber One: {insights.avgUberOnePercent.toFixed(1)}%
                </Badge>
              )}
              {visibleMetrics.has("payout") && insights.totalPayout > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Wallet className="h-3 w-3 text-cyan-500" />
                  Versement = {insights.totalPayout.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                Base : {profitabilityBase === "net" ? "CA effectif (Net)" : "CA déclaré (Brut)"}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="label" 
                className="text-xs"
                tick={{ fontSize: 11 }}
              />
              {/* Left axis for monetary values (CA + Promos + Payout) */}
              {(visibleMetrics.has("revenue") || visibleMetrics.has("promos") || visibleMetrics.has("payout")) && (
                <YAxis 
                  yAxisId="left"
                  className="text-xs"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
                />
              )}
              {/* Right axis for percentage (Profitability + Uber One) - dynamic scale */}
              {(visibleMetrics.has("profitability") || visibleMetrics.has("uberOne")) && (
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  className="text-xs"
                  unit="%"
                  domain={percentageDomain}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload;
                  return (
                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium mb-2">{label}</p>
                      <div className="space-y-1.5 text-sm">
                        {visibleMetrics.has("revenue") && (
                          <p className="flex justify-between gap-4">
                            <span className="flex items-center gap-1.5">
                              <span 
                                className="w-2.5 h-2.5 rounded-sm" 
                                style={{ backgroundColor: METRIC_CONFIG.revenue.color }}
                              />
                              CA :
                            </span>
                            <span className="font-medium">
                              {data?.revenue?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                            </span>
                          </p>
                        )}
                        {visibleMetrics.has("promos") && (
                          <p className="flex justify-between gap-4">
                            <span className="flex items-center gap-1.5">
                              <span 
                                className="w-2.5 h-2.5 rounded-sm" 
                                style={{ backgroundColor: METRIC_CONFIG.promos.color }}
                              />
                              Promos :
                            </span>
                            <span className="font-medium text-orange-600">
                              {data?.promos?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                              <span className="text-xs text-muted-foreground ml-1">
                                ({data?.revenue > 0 ? ((data?.promos / data?.revenue) * 100).toFixed(1) : 0}%)
                              </span>
                            </span>
                          </p>
                        )}
                        {visibleMetrics.has("profitability") && (
                          <p className="flex justify-between gap-4 pt-1 border-t border-border mt-1">
                            <span className="flex items-center gap-1.5">
                              <span 
                                className="w-2.5 h-2.5 rounded-sm" 
                                style={{ backgroundColor: METRIC_CONFIG.profitability.color }}
                              />
                              Rentabilité :
                            </span>
                            <span className="font-medium text-emerald-600">
                              {data?.profitability?.toFixed(1)}%
                            </span>
                          </p>
                        )}
                        {visibleMetrics.has("payout") && (
                          <p className="flex justify-between gap-4">
                            <span className="flex items-center gap-1.5">
                              <span 
                                className="w-2.5 h-2.5 rounded-sm" 
                                style={{ backgroundColor: METRIC_CONFIG.payout.color }}
                              />
                              Versement :
                            </span>
                            <span className="font-medium text-cyan-600">
                              {data?.payout?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                            </span>
                          </p>
                        )}
                        {visibleMetrics.has("uberOne") && data?.uberOnePercent > 0 && (
                          <p className="flex justify-between gap-4 pt-1 border-t border-border mt-1">
                            <span className="flex items-center gap-1.5">
                              <span 
                                className="w-2.5 h-2.5 rounded-sm" 
                                style={{ backgroundColor: METRIC_CONFIG.uberOne.color }}
                              />
                              Uber One :
                            </span>
                            <span className="font-medium text-purple-600">
                              {data?.uberOnePercent?.toFixed(1)}%
                              <span className="text-xs text-muted-foreground ml-1">
                                ({data?.uberOneCount}/{data?.uberOneTotalOrders})
                              </span>
                            </span>
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground pt-1">
                          {data?.orders} commandes
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: "12px" }}
                formatter={(value) => {
                  if (value === "revenue") return "Chiffre d'affaires";
                  if (value === "promos") return "Promotions";
                  if (value === "profitability") return "Rentabilité (%)";
                  if (value === "uberOne") return "Uber One (%)";
                  if (value === "payout") return "Versement Net";
                  return value;
                }}
              />
              
              {/* Revenue bars */}
              {visibleMetrics.has("revenue") && (
                <Bar
                  yAxisId="left"
                  dataKey="revenue"
                  name="revenue"
                  fill={METRIC_CONFIG.revenue.color}
                  radius={[4, 4, 0, 0]}
                  animationDuration={CHART_ANIMATION_DURATION}
                  animationEasing={CHART_ANIMATION_EASING}
                />
              )}
              
              {/* Promos bars (stacked or side-by-side based on revenue visibility) */}
              {visibleMetrics.has("promos") && (
                <Bar
                  yAxisId="left"
                  dataKey="promos"
                  name="promos"
                  fill={METRIC_CONFIG.promos.color}
                  radius={[4, 4, 0, 0]}
                  animationDuration={CHART_ANIMATION_DURATION}
                  animationEasing={CHART_ANIMATION_EASING}
                />
              )}
              
              {/* Payout bars */}
              {visibleMetrics.has("payout") && (
                <Bar
                  yAxisId="left"
                  dataKey="payout"
                  name="payout"
                  fill={METRIC_CONFIG.payout.color}
                  fillOpacity={0.7}
                  radius={[4, 4, 0, 0]}
                  animationDuration={CHART_ANIMATION_DURATION}
                  animationEasing={CHART_ANIMATION_EASING}
                />
              )}
              
              {/* Profitability line */}
              {visibleMetrics.has("profitability") && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="profitability"
                  name="profitability"
                  stroke={METRIC_CONFIG.profitability.color}
                  strokeWidth={3}
                  dot={{ fill: METRIC_CONFIG.profitability.color, r: 4, strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  animationDuration={CHART_ANIMATION_DURATION}
                  animationEasing={CHART_ANIMATION_EASING}
                />
              )}
              
              {/* Uber One line (dashed) */}
              {visibleMetrics.has("uberOne") && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="uberOnePercent"
                  name="uberOne"
                  stroke={METRIC_CONFIG.uberOne.color}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: METRIC_CONFIG.uberOne.color, r: 3 }}
                  activeDot={{ r: 5 }}
                  animationDuration={CHART_ANIMATION_DURATION}
                  animationEasing={CHART_ANIMATION_EASING}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
