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
  Cell,
} from "recharts";
import {
  Target,
  Lightbulb,
  HelpCircle,
  BarChart3,
  TableIcon,
  ArrowUpDown,
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

const QUADRANT_COLORS = {
  highTrafficHighConv: "hsl(142 76% 36%)",
  highTrafficLowConv: "hsl(38 92% 50%)",
  lowTrafficHighConv: "hsl(217 91% 60%)",
  lowTrafficLowConv: "hsl(0 84% 60%)",
};

const QUADRANT_LABELS: Record<string, { label: string; emoji: string }> = {
  highTrafficHighConv: { label: "Stars", emoji: "⭐" },
  highTrafficLowConv: { label: "Opportunités", emoji: "⚠️" },
  lowTrafficHighConv: { label: "Niches", emoji: "💎" },
  lowTrafficLowConv: { label: "À surveiller", emoji: "🔴" },
};

type SortKey = "restaurantName" | "visits" | "orders" | "conversionRate";
type SortDir = "asc" | "desc";

export function ConversionScatterPlot({
  data,
  className,
  highlightedRestaurants = [],
}: ConversionScatterPlotProps) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [activeQuadrants, setActiveQuadrants] = useState<Set<string>>(new Set(Object.keys(QUADRANT_LABELS)));
  const [sortKey, setSortKey] = useState<SortKey>("conversionRate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const scatterData = useMemo(() => {
    return data.map((r) => ({
      ...r,
      conversionRate: r.visits > 0 ? (r.orders / r.visits) * 100 : 0,
      bubbleSize: Math.min(Math.max(r.orders * 2, 60), 1200),
    }));
  }, [data]);

  const averages = useMemo(() => {
    if (scatterData.length === 0) return { visits: 0, conversion: 0 };
    const avgVisits = scatterData.reduce((sum, r) => sum + r.visits, 0) / scatterData.length;
    const avgConversion = scatterData.reduce((sum, r) => sum + r.conversionRate, 0) / scatterData.length;
    return { visits: avgVisits, conversion: avgConversion };
  }, [scatterData]);

  const getQuadrantKey = (visits: number, conversion: number) => {
    if (visits >= averages.visits) {
      return conversion >= averages.conversion ? "highTrafficHighConv" : "highTrafficLowConv";
    }
    return conversion >= averages.conversion ? "lowTrafficHighConv" : "lowTrafficLowConv";
  };

  const getQuadrantColor = (visits: number, conversion: number) => {
    return QUADRANT_COLORS[getQuadrantKey(visits, conversion)];
  };

  const filteredData = useMemo(() => {
    return scatterData.filter(r => activeQuadrants.has(getQuadrantKey(r.visits, r.conversionRate)));
  }, [scatterData, activeQuadrants, averages]);

  const sortedTableData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [filteredData, sortKey, sortDir]);

  const opportunities = useMemo(() => {
    return scatterData
      .filter((r) => r.visits > averages.visits && r.conversionRate < averages.conversion)
      .sort((a, b) => b.visits - a.visits);
  }, [scatterData, averages]);

  const toggleQuadrant = (key: string) => {
    setActiveQuadrants(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    const qKey = getQuadrantKey(d.visits, d.conversionRate);
    const quadrantLabel = `${QUADRANT_LABELS[qKey].emoji} ${QUADRANT_LABELS[qKey].label}`;

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
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("chart")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "chart" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BarChart3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "table" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TableIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[280px]">
                  <p className="text-sm mb-2">Identifiez les opportunités d'amélioration :</p>
                  <ul className="text-xs space-y-1">
                    {Object.entries(QUADRANT_LABELS).map(([key, { label, emoji }]) => (
                      <li key={key} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: QUADRANT_COLORS[key as keyof typeof QUADRANT_COLORS] }} />
                        {emoji} {label}
                      </li>
                    ))}
                  </ul>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Interactive legend / quadrant filter */}
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(QUADRANT_LABELS).map(([key, { label }]) => {
            const isActive = activeQuadrants.has(key);
            const count = scatterData.filter(r => getQuadrantKey(r.visits, r.conversionRate) === key).length;
            return (
              <button
                key={key}
                onClick={() => toggleQuadrant(key)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all",
                  isActive
                    ? "border-border bg-background"
                    : "border-transparent bg-muted/50 opacity-50"
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: QUADRANT_COLORS[key as keyof typeof QUADRANT_COLORS] }}
                />
                <span>{label}</span>
                <span className="text-muted-foreground">({count})</span>
              </button>
            );
          })}
        </div>

        {viewMode === "chart" ? (
          <div className="h-[400px]">
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
                <ZAxis type="number" dataKey="bubbleSize" range={[60, 400]} />
                
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
                
                <Scatter data={filteredData} fill="hsl(var(--primary))">
                  {filteredData.map((entry, index) => {
                    const isHighlighted = highlightedRestaurants.includes(entry.restaurantId);
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={getQuadrantColor(entry.visits, entry.conversionRate)}
                        fillOpacity={isHighlighted ? 1 : 0.6}
                        stroke={isHighlighted ? "hsl(var(--foreground))" : getQuadrantColor(entry.visits, entry.conversionRate)}
                        strokeWidth={isHighlighted ? 3 : 1}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Table view */
          <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                  <th
                    className="text-left px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("restaurantName")}
                  >
                    <span className="flex items-center gap-1">Restaurant <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th
                    className="text-right px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("visits")}
                  >
                    <span className="flex items-center justify-end gap-1">Visites <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th
                    className="text-right px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("orders")}
                  >
                    <span className="flex items-center justify-end gap-1">Commandes <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th
                    className="text-right px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("conversionRate")}
                  >
                    <span className="flex items-center justify-end gap-1">Conv. % <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Quadrant</th>
                </tr>
              </thead>
              <tbody>
                {sortedTableData.map((r, i) => {
                  const qKey = getQuadrantKey(r.visits, r.conversionRate);
                  const isHighlighted = highlightedRestaurants.includes(r.restaurantId);
                  return (
                    <tr
                      key={r.restaurantId}
                      className={cn(
                        "border-t border-border hover:bg-muted/30 transition-colors",
                        isHighlighted && "bg-primary/5"
                      )}
                    >
                      <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-sm">{r.restaurantName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.visits.toLocaleString("fr-FR")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.orders.toLocaleString("fr-FR")}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.conversionRate.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: QUADRANT_COLORS[qKey as keyof typeof QUADRANT_COLORS],
                            color: QUADRANT_COLORS[qKey as keyof typeof QUADRANT_COLORS],
                          }}
                        >
                          {QUADRANT_LABELS[qKey].emoji} {QUADRANT_LABELS[qKey].label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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
      </CardContent>
    </Card>
  );
}
