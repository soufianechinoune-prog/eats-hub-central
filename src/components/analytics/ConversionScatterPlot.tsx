import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
  ReferenceDot,
  Cell,
} from "recharts";
import {
  Target,
  Lightbulb,
  HelpCircle,
  BarChart3,
  TableIcon,
  ArrowUpDown,
  Maximize2,
  Minimize2,
  Users,
  TrendingUp,
  TrendingDown,
  X,
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
  startDate?: Date;
  endDate?: Date;
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

interface BenchmarkResult {
  match_level: "city" | "postal_code" | "none";
  competitor_count: number;
  avg_visits: number;
  avg_conversion_rate: number;
  city: string | null;
  postal_code: string | null;
}

export function ConversionScatterPlot({
  data,
  className,
  highlightedRestaurants = [],
}: ConversionScatterPlotProps) {
  const { startDate, endDate } = useAnalyticsContext();
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [expanded, setExpanded] = useState(false);
  const [activeQuadrants, setActiveQuadrants] = useState<Set<string>>(new Set(Object.keys(QUADRANT_LABELS)));
  const [sortKey, setSortKey] = useState<SortKey>("conversionRate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  // Fetch contextual benchmark when a restaurant is selected
  const { data: benchmark, isFetching: benchmarkLoading } = useQuery({
    queryKey: [
      "scatter_local_benchmark",
      selectedRestaurantId,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async (): Promise<BenchmarkResult | null> => {
      if (!selectedRestaurantId) return null;
      const { data, error } = await supabase.rpc("get_restaurant_local_benchmark", {
        p_restaurant_id: selectedRestaurantId,
        p_start_date: format(startDate, "yyyy-MM-dd"),
        p_end_date: format(endDate, "yyyy-MM-dd"),
      });
      if (error) {
        console.error("[ConversionScatterPlot] benchmark error", error);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return row as BenchmarkResult | null;
    },
    enabled: !!selectedRestaurantId,
    staleTime: 60_000,
  });


  // Anonymized benchmark points formatted for the scatter (gray series)
  const benchmarkScatter = useMemo(() => {
    return (benchmarkData || []).map((b) => ({
      anon_id: b.anon_id,
      city: b.city,
      visits: b.visits,
      orders: b.orders,
      conversionRate: Number(b.conversion_rate) || 0,
      // Slightly smaller dot size than brand points
      bubbleSize: Math.min(Math.max(b.orders * 1.5, 50), 800),
      isCompetitor: true as const,
    }));
  }, [benchmarkData]);

  const benchmarkAvg = useMemo(() => {
    if (benchmarkScatter.length === 0) return null;
    const sum = benchmarkScatter.reduce((s, p) => s + p.conversionRate, 0);
    return sum / benchmarkScatter.length;
  }, [benchmarkScatter]);


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

    // Anonymized competitor tooltip — no name, no restaurant_id
    if (d.isCompetitor) {
      return (
        <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
          <p className="font-semibold text-sm mb-2 text-muted-foreground">
            Concurrent local · {d.city}
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Visites</span>
              <span className="font-medium">{d.visits.toLocaleString("fr-FR")}</span>
            </div>
            <div className="flex justify-between">
              <span>Taux de conversion</span>
              <span className="font-bold">{d.conversionRate.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Commandes</span>
              <span className="font-medium">{d.orders.toLocaleString("fr-FR")}</span>
            </div>
          </div>
        </div>
      );
    }

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
            {viewMode === "chart" && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={expanded ? "Réduire" : "Agrandir"}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            )}
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
        {/* Benchmark toggle (only shown if data is available) */}
        {benchmarkScatter.length > 0 && (
          <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="benchmark-toggle" className="text-sm cursor-pointer">
                Benchmark local <span className="text-muted-foreground">(même ville)</span>
              </Label>
            </div>
            <div className="flex items-center gap-2">
              {showBenchmark && (
                <span className="text-xs text-muted-foreground">
                  {benchmarkScatter.length} concurrent{benchmarkScatter.length > 1 ? "s" : ""}
                </span>
              )}
              <Switch
                id="benchmark-toggle"
                checked={showBenchmark}
                onCheckedChange={handleBenchmarkToggle}
              />
            </div>
          </div>
        )}

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
          {showBenchmark && benchmarkScatter.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-background">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 border border-muted-foreground/60" />
              <span>Concurrents</span>
              <span className="text-muted-foreground">({benchmarkScatter.length})</span>
            </div>
          )}
        </div>

        {/* Benchmark comparison summary */}
        {showBenchmark && benchmarkAvg !== null && averages.conversion > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
              averages.conversion >= benchmarkAvg
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5"
            )}
          >
            {averages.conversion >= benchmarkAvg ? (
              <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <TrendingDown className="h-4 w-4 text-amber-600 shrink-0" />
            )}
            <div className="text-xs">
              Votre taux de conversion moyen : <span className="font-semibold">{averages.conversion.toFixed(2)}%</span>
              <span className="text-muted-foreground"> · Concurrents locaux : </span>
              <span className="font-semibold">{benchmarkAvg.toFixed(2)}%</span>
              <span className={cn(
                "ml-2 font-medium",
                averages.conversion >= benchmarkAvg ? "text-emerald-700" : "text-amber-700"
              )}>
                ({averages.conversion >= benchmarkAvg ? "+" : ""}{(averages.conversion - benchmarkAvg).toFixed(2)} pt)
              </span>
            </div>
          </motion.div>
        )}

        {viewMode === "chart" ? (
          <div style={{ height: expanded ? 700 : 500 }} className="transition-all duration-300">
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
                  domain={([dataMin, dataMax]: [number, number]) => [Math.max(0, dataMin - 0.5), dataMax + 1]}
                  label={{ value: "Conversion % →", angle: -90, position: "left", offset: -5, className: "text-xs fill-muted-foreground" }}
                />
                <ZAxis type="number" dataKey="bubbleSize" range={[40, 300]} />
                
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

                {/* Anonymized competitor points (rendered first so they sit behind brand points) */}
                {showBenchmark && benchmarkScatter.length > 0 && (
                  <Scatter data={benchmarkScatter} fill="hsl(var(--muted-foreground))">
                    {benchmarkScatter.map((_, index) => (
                      <Cell
                        key={`bench-cell-${index}`}
                        fill="hsl(var(--muted-foreground))"
                        fillOpacity={0.35}
                        stroke="hsl(var(--muted-foreground))"
                        strokeOpacity={0.5}
                        strokeWidth={1}
                      />
                    ))}
                  </Scatter>
                )}

                <Scatter data={filteredData} fill="hsl(var(--primary))">
                  {filteredData.map((entry, index) => {
                    const isHighlighted = highlightedRestaurants.includes(entry.restaurantId);
                    const dimByBenchmark = showBenchmark && highlightedRestaurants.length > 0 && !isHighlighted;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={getQuadrantColor(entry.visits, entry.conversionRate)}
                        fillOpacity={isHighlighted ? 1 : (dimByBenchmark ? 0.35 : 0.6)}
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
          <div className="overflow-auto rounded-lg border border-border" style={{ maxHeight: expanded ? 700 : 400 }}>
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
