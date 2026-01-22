import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  ReferenceLine,
} from "recharts";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface DailyData {
  date: string;
  sales_incl_vat: number;
  promo_incl_vat: number;
  net_payout?: number;
  meal_voucher_amount?: number;
  order_count?: number;
}

interface PromotionEvolutionChartProps {
  data: DailyData[];
  previousData?: DailyData[];
  granularity: "daily" | "weekly" | "monthly";
  isLoading?: boolean;
  selectedYear?: number;
}

const CHART_ANIMATION_DURATION = 500;
const CHART_ANIMATION_EASING = "ease-out";

export function PromotionEvolutionChart({
  data,
  previousData,
  granularity,
  isLoading = false,
  selectedYear,
}: PromotionEvolutionChartProps) {
  // Aggregate data based on granularity
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const aggregated: Record<string, { 
      label: string; 
      promo: number; 
      sales: number; 
      promoPercent: number;
      prevPromo?: number;
      prevPromoPercent?: number;
    }> = {};

    // Aggregate current period
    data.forEach((item) => {
      const date = parseISO(item.date);
      let key: string;
      let label: string;

      if (granularity === "daily") {
        key = item.date;
        label = format(date, "dd MMM", { locale: fr });
      } else if (granularity === "weekly") {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        key = format(weekStart, "yyyy-MM-dd");
        label = `S${format(weekStart, "w")}`;
      } else {
        const monthStart = startOfMonth(date);
        key = format(monthStart, "yyyy-MM");
        label = format(date, "MMM", { locale: fr });
      }

      if (!aggregated[key]) {
        aggregated[key] = { label, promo: 0, sales: 0, promoPercent: 0 };
      }
      aggregated[key].promo += Math.abs(item.promo_incl_vat || 0);
      aggregated[key].sales += item.sales_incl_vat || 0;
    });

    // Aggregate previous period for comparison
    if (previousData && previousData.length > 0) {
      const prevAggregated: Record<string, { promo: number; sales: number }> = {};
      
      previousData.forEach((item) => {
        const date = parseISO(item.date);
        let key: string;

        if (granularity === "daily") {
          // For daily, we'll match by day index
          key = format(date, "dd");
        } else if (granularity === "weekly") {
          key = format(date, "w");
        } else {
          key = format(date, "MM");
        }

        if (!prevAggregated[key]) {
          prevAggregated[key] = { promo: 0, sales: 0 };
        }
        prevAggregated[key].promo += Math.abs(item.promo_incl_vat || 0);
        prevAggregated[key].sales += item.sales_incl_vat || 0;
      });

      // Merge prev data
      Object.entries(aggregated).forEach(([key, val]) => {
        const date = parseISO(key.includes("-") && key.length === 10 ? key : `${key}-01`);
        let matchKey: string;

        if (granularity === "daily") {
          matchKey = format(date, "dd");
        } else if (granularity === "weekly") {
          matchKey = format(startOfWeek(date, { weekStartsOn: 1 }), "w");
        } else {
          matchKey = format(date, "MM");
        }

        const prev = prevAggregated[matchKey];
        if (prev) {
          val.prevPromo = prev.promo;
          val.prevPromoPercent = prev.sales > 0 ? (prev.promo / prev.sales) * 100 : 0;
        }
      });
    }

    // Calculate percentages
    Object.values(aggregated).forEach((item) => {
      item.promoPercent = item.sales > 0 ? (item.promo / item.sales) * 100 : 0;
    });

    return Object.values(aggregated).sort((a, b) => {
      // Sort by label naturally
      return a.label.localeCompare(b.label, 'fr', { numeric: true });
    });
  }, [data, previousData, granularity]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { totalPromo: 0, avgPercent: 0, variation: null };
    }

    const totalPromo = chartData.reduce((sum, d) => sum + d.promo, 0);
    const totalSales = chartData.reduce((sum, d) => sum + d.sales, 0);
    const avgPercent = totalSales > 0 ? (totalPromo / totalSales) * 100 : 0;

    const prevTotalPromo = chartData.reduce((sum, d) => sum + (d.prevPromo || 0), 0);
    const variation = prevTotalPromo > 0 
      ? ((totalPromo - prevTotalPromo) / prevTotalPromo) * 100 
      : null;

    return { totalPromo, avgPercent, variation };
  }, [chartData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-orange-500" />
            Évolution des Promotions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-orange-500" />
            Évolution des Promotions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Aucune donnée de promotions sur cette période
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-orange-500" />
            Évolution des Promotions
            {selectedYear && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({selectedYear})
              </span>
            )}
          </CardTitle>
          
          {/* KPIs */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">Total Promos</span>
              <span className="text-lg font-bold text-orange-600">
                {kpis.totalPromo.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">% du CA</span>
              <span className="text-lg font-bold">
                {kpis.avgPercent.toFixed(1)}%
              </span>
            </div>
            {kpis.variation !== null && (
              <Badge 
                variant={kpis.variation > 0 ? "destructive" : "secondary"}
                className="flex items-center gap-1"
              >
                {kpis.variation > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : kpis.variation < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {kpis.variation > 0 ? "+" : ""}{kpis.variation.toFixed(1)}% vs N-1
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Explanation */}
        <div className="bg-muted/50 rounded-lg p-3 mb-4 flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong>Promotions</strong> = réductions appliquées aux commandes (offres %, BOGO, etc.).
            Un pourcentage élevé peut indiquer une dépendance aux promos pour générer du volume.
          </p>
        </div>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="label" 
                className="text-xs"
                tick={{ fontSize: 11 }}
              />
              <YAxis 
                yAxisId="left"
                className="text-xs"
                tickFormatter={(v) => `${v.toLocaleString("fr-FR")} €`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                className="text-xs"
                unit="%"
                domain={[0, 'auto']}
              />
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
                      <div className="space-y-1 text-sm">
                        <p className="flex justify-between gap-4">
                          <span className="text-orange-600">Promos :</span>
                          <span className="font-medium">
                            {data?.promo?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                          </span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">% du CA :</span>
                          <span className="font-medium">{data?.promoPercent?.toFixed(1)}%</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">CA période :</span>
                          <span className="font-medium">
                            {data?.sales?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                          </span>
                        </p>
                        {data?.prevPromo !== undefined && (
                          <p className="flex justify-between gap-4 pt-1 border-t border-border mt-1 text-xs">
                            <span className="text-muted-foreground">Promos N-1 :</span>
                            <span>{data?.prevPromo?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: "12px" }}
                formatter={(value) => {
                  if (value === "promo") return "Montant Promos (€)";
                  if (value === "promoPercent") return "% du CA";
                  if (value === "prevPromoPercent") return "% du CA N-1";
                  return value;
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="promo"
                name="promo"
                fill="hsl(25, 95%, 53%)"
                radius={[4, 4, 0, 0]}
                animationDuration={CHART_ANIMATION_DURATION}
                animationEasing={CHART_ANIMATION_EASING}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="promoPercent"
                name="promoPercent"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
                animationDuration={CHART_ANIMATION_DURATION}
                animationEasing={CHART_ANIMATION_EASING}
              />
              {previousData && previousData.length > 0 && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="prevPromoPercent"
                  name="prevPromoPercent"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
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
