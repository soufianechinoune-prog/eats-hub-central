import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";
import {
  Target,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  HelpCircle,
} from "lucide-react";

interface RestaurantConversionData {
  restaurantId: string;
  restaurantName: string;
  visits: number;
  views: number;
  cart: number;
  orders: number;
  revenue?: number;
}

interface ConversionScatterPlotProps {
  data: RestaurantConversionData[];
  className?: string;
  highlightedRestaurants?: string[];
}

// Quadrant colors
const QUADRANT_COLORS = {
  highTrafficHighConv: "hsl(142 76% 36%)", // Green - Stars
  highTrafficLowConv: "hsl(38 92% 50%)",  // Orange - Opportunity
  lowTrafficHighConv: "hsl(217 91% 60%)", // Blue - Niche
  lowTrafficLowConv: "hsl(0 84% 60%)",    // Red - Needs attention
};

export function ConversionScatterPlot({
  data,
  className,
  highlightedRestaurants = [],
}: ConversionScatterPlotProps) {
  // Calculate scatter data
  const scatterData = useMemo(() => {
    return data.map((r) => ({
      ...r,
      conversionRate: r.visits > 0 ? (r.orders / r.visits) * 100 : 0,
      // Bubble size based on orders (min 100, max 2000)
      bubbleSize: Math.min(Math.max(r.orders * 2, 100), 2000),
    }));
  }, [data]);

  // Calculate averages for quadrant lines
  const averages = useMemo(() => {
    const avgVisits = scatterData.reduce((sum, r) => sum + r.visits, 0) / scatterData.length;
    const avgConversion = scatterData.reduce((sum, r) => sum + r.conversionRate, 0) / scatterData.length;
    return { visits: avgVisits, conversion: avgConversion };
  }, [scatterData]);

  // Identify opportunities (high traffic, low conversion)
  const opportunities = useMemo(() => {
    return scatterData
      .filter((r) => r.visits > averages.visits && r.conversionRate < averages.conversion)
      .sort((a, b) => b.visits - a.visits);
  }, [scatterData, averages]);

  // Get quadrant for coloring
  const getQuadrantColor = (visits: number, conversion: number) => {
    if (visits >= averages.visits) {
      return conversion >= averages.conversion
        ? QUADRANT_COLORS.highTrafficHighConv
        : QUADRANT_COLORS.highTrafficLowConv;
    }
    return conversion >= averages.conversion
      ? QUADRANT_COLORS.lowTrafficHighConv
      : QUADRANT_COLORS.lowTrafficLowConv;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    const quadrantLabel = d.visits >= averages.visits
      ? d.conversionRate >= averages.conversion
        ? "⭐ Star performer"
        : "⚠️ Fort trafic, conversion faible"
      : d.conversionRate >= averages.conversion
        ? "💎 Niche performante"
        : "🔴 À surveiller";

    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
        <p className="font-semibold text-sm mb-2">{d.restaurantName}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Visites</span>
            <span className="font-medium">{d.visits.toLocaleString("fr-FR")}</span>
          </div>
          <div className="flex justify-between">
            <span>Taux de conversion</span>
            <span className="font-bold text-primary">{d.conversionRate.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Commandes</span>
            <span className="font-medium">{d.orders.toLocaleString("fr-FR")}</span>
          </div>
          <div className="pt-2 border-t border-border mt-2">
            <span className="text-muted-foreground">{quadrantLabel}</span>
          </div>
        </div>
      </div>
    );
  };

  if (data.length < 2) return null;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Visites vs Conversion</span>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[280px]">
                <p className="text-sm mb-2">Identifiez les opportunités d'amélioration :</p>
                <ul className="text-xs space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: QUADRANT_COLORS.highTrafficHighConv }} />
                    Stars : Fort trafic + bonne conversion
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: QUADRANT_COLORS.highTrafficLowConv }} />
                    Opportunités : Fort trafic à mieux convertir
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: QUADRANT_COLORS.lowTrafficHighConv }} />
                    Niches : Bonne conversion, besoin de visibilité
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: QUADRANT_COLORS.lowTrafficLowConv }} />
                    À surveiller : Actions prioritaires
                  </li>
                </ul>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Scatter chart */}
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                dataKey="visits"
                name="Visites"
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                className="text-xs"
                label={{ value: "Visites →", position: "bottom", offset: 0, className: "text-xs fill-muted-foreground" }}
              />
              <YAxis
                type="number"
                dataKey="conversionRate"
                name="Conversion"
                tickFormatter={(v) => `${v.toFixed(1)}%`}
                className="text-xs"
                label={{ value: "Conversion % →", angle: -90, position: "left", offset: -5, className: "text-xs fill-muted-foreground" }}
              />
              <ZAxis type="number" dataKey="bubbleSize" range={[100, 800]} />
              
              {/* Reference lines for averages */}
              <ReferenceLine
                x={averages.visits}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                y={averages.conversion}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
              />

              <Tooltip content={<CustomTooltip />} />
              
              <Scatter data={scatterData} fill="hsl(var(--primary))">
                {scatterData.map((entry, index) => {
                  const isHighlighted = highlightedRestaurants.includes(entry.restaurantId);
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={getQuadrantColor(entry.visits, entry.conversionRate)}
                      fillOpacity={isHighlighted ? 1 : 0.6}
                      stroke={isHighlighted ? "hsl(var(--foreground))" : getQuadrantColor(entry.visits, entry.conversionRate)}
                      strokeWidth={isHighlighted ? 4 : 2}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Opportunities highlight */}
        {opportunities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3"
          >
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium mb-1">
                  {opportunities.length} opportunité{opportunities.length > 1 ? "s" : ""} d'amélioration
                </p>
                <p className="text-xs text-muted-foreground">
                  Fort trafic mais conversion sous la moyenne :
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {opportunities.slice(0, 5).map((r) => (
                    <Badge key={r.restaurantId} variant="outline" className="text-xs bg-amber-500/10">
                      {r.restaurantName}
                      <span className="ml-1 text-amber-600">{r.conversionRate.toFixed(1)}%</span>
                    </Badge>
                  ))}
                  {opportunities.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{opportunities.length - 5} autres
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: QUADRANT_COLORS.highTrafficHighConv }} />
            Stars
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: QUADRANT_COLORS.highTrafficLowConv }} />
            Opportunités
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: QUADRANT_COLORS.lowTrafficHighConv }} />
            Niches
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: QUADRANT_COLORS.lowTrafficLowConv }} />
            À surveiller
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
