import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useUberOneStats, SIGNIFICANCE_THRESHOLD, type UberOneByRestaurant } from "@/hooks/useUberOneStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Users, TrendingUp, TrendingDown, Minus, Crown, BarChart3, LineChartIcon, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, startOfWeek } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Color palette for restaurant lines
const RESTAURANT_COLORS = [
  "#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", 
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

type ChartMode = "average" | "detailed";
type SortField = "name" | "uberOnePct";
type SortDir = "asc" | "desc";

export function UberOneAnalysis() {
  const {
    selectedRestaurants,
    visibleRestaurants,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange: contextDateRange,
    selectedPlatform,
    isNetworkView,
  } = useAnalyticsContext();

  // Use selectedRestaurants for calculations (active chips = dark background)
  // Fallback to pinned restaurants via useUberOneStats when no selection
  const restaurantIdsForQuery = useMemo(() => {
    if (selectedRestaurants && selectedRestaurants.length > 0) {
      return selectedRestaurants;
    }
    return [];
  }, [selectedRestaurants]);

  const [chartMode, setChartMode] = useState<ChartMode>("average");
  const [sortField, setSortField] = useState<SortField>("uberOnePct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedRestaurant, setSelectedRestaurant] = useState<UberOneByRestaurant | null>(null);

  // Calculate date range based on period mode
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    
    switch (periodMode) {
      case "month":
        const monthStart = startOfMonth(new Date(selectedYear, selectedMonth - 1, 1));
        const monthEnd = endOfMonth(monthStart);
        return { startDate: monthStart, endDate: monthEnd };
      
      case "range":
        if (contextDateRange?.from && contextDateRange?.to) {
          return { startDate: contextDateRange.from, endDate: contextDateRange.to };
        }
        return { startDate: startOfYear(new Date(selectedYear, 0, 1)), endDate: now };
      
      case "7d":
        return { startDate: subDays(now, 7), endDate: now };
      
      case "30d":
        return { startDate: subDays(now, 30), endDate: now };
      
      case "previous_week":
        const lastWeekEnd = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1);
        const lastWeekStart = startOfWeek(lastWeekEnd, { weekStartsOn: 1 });
        return { startDate: lastWeekStart, endDate: lastWeekEnd };
      
      case "current_month":
        return { startDate: startOfMonth(now), endDate: now };
      
      default: // "year"
        const yearStart = startOfYear(new Date(selectedYear, 0, 1));
        const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
        // Cap to today if current year
        const effectiveEnd = selectedYear === now.getFullYear() && yearEnd > now 
          ? now 
          : yearEnd;
        return {
          startDate: yearStart,
          endDate: effectiveEnd,
        };
    }
  }, [periodMode, selectedYear, selectedMonth, contextDateRange]);

  const { globalStats, evolution, evolutionByRestaurant, byRestaurant, comparison, isLoading, restaurantMap, effectiveRestaurantIds } = useUberOneStats({
    restaurantIds: isNetworkView ? [] : restaurantIdsForQuery,
    startDate,
    endDate,
    periodMode,
    platform: selectedPlatform,
    useAllActive: isNetworkView,
  });

  // Determine if we can show detailed view based on effective restaurant count
  const hasMultipleRestaurants = effectiveRestaurantIds && effectiveRestaurantIds.length > 1;

  // Calcul du domaine Y dynamique pour le graphique d'évolution
  const evolutionYDomain = useMemo(() => {
    if (chartMode === "average") {
      if (evolution.length === 0) return [0, 100];
      const values = evolution.map(e => e.uberOnePercent);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const range = maxVal - minVal;
      const margin = Math.max(range * 0.1, 5);
      const yMin = Math.max(0, Math.floor((minVal - margin) / 10) * 10);
      const yMax = Math.min(100, Math.ceil((maxVal + margin) / 10) * 10);
      return [yMin, yMax];
    } else {
      // For detailed mode, compute from all restaurant values
      if (evolutionByRestaurant.length === 0 || byRestaurant.length === 0) return [0, 100];
      const allValues: number[] = [];
      evolutionByRestaurant.forEach(point => {
        byRestaurant.forEach(r => {
          const val = point[r.restaurantId];
          if (typeof val === 'number') allValues.push(val);
        });
      });
      if (allValues.length === 0) return [0, 100];
      const minVal = Math.min(...allValues);
      const maxVal = Math.max(...allValues);
      const range = maxVal - minVal;
      const margin = Math.max(range * 0.1, 5);
      const yMin = Math.max(0, Math.floor((minVal - margin) / 10) * 10);
      const yMax = Math.min(100, Math.ceil((maxVal + margin) / 10) * 10);
      return [yMin, yMax];
    }
  }, [evolution, evolutionByRestaurant, byRestaurant, chartMode]);

  // Restaurant color mapping
  const restaurantColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    byRestaurant.forEach((r, i) => {
      map[r.restaurantId] = RESTAURANT_COLORS[i % RESTAURANT_COLORS.length];
    });
    return map;
  }, [byRestaurant]);

  // Get short restaurant name
  const getShortName = (name: string) => {
    if (name.toLowerCase().includes("chicken street")) {
      const cityMatch = name.match(/chicken street\s+(.+)/i);
      if (cityMatch) return `CS ${cityMatch[1].toUpperCase()}`;
    }
    return name.length > 15 ? name.slice(0, 12) + "..." : name;
  };

  // Can show detailed view?
  const canShowDetailed = hasMultipleRestaurants || byRestaurant.length > 1;

  // Sorted restaurants for ranking table (must be before early returns)
  const sortedRestaurants = useMemo(() => {
    return [...byRestaurant].sort((a, b) => {
      const mod = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "name": return mod * a.restaurantName.localeCompare(b.restaurantName);
        case "uberOnePct": return mod * (a.uberOnePercent - b.uberOnePercent);
        default: return 0;
      }
    });
  }, [byRestaurant, sortField, sortDir]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!globalStats || globalStats.totalOrders === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Aucune donnée Uber One disponible pour cette période
          </p>
        </CardContent>
      </Card>
    );
  }

  const evolutionChartConfig = {
    uberOnePercent: {
      label: "% Uber One",
      color: "hsl(var(--chart-1))",
    },
  };

  const getDiffIcon = (diff: number) => {
    if (diff > 1) return <TrendingUp className="h-4 w-4 text-chart-2" />;
    if (diff < -1) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === "€") return `${value.toFixed(2)} €`;
    if (unit === "min") return `${value.toFixed(1)} min`;
    if (unit === "%") return `${value.toFixed(1)}%`;
    return value.toLocaleString("fr-FR");
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Section: KPI Gauge + Evolution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main KPI - Uber One Percentage */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Répartition Clientèle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Uber One Gauge */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-chart-1" />
                    Uber One
                  </span>
                  <span className="text-2xl font-bold text-chart-1">
                    {globalStats.uberOnePercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-chart-1 rounded-full transition-all duration-500"
                    style={{ width: `${globalStats.uberOnePercent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>{globalStats.uberOneCount.toLocaleString("fr-FR")} commandes</span>
                </div>
              </div>

              {/* Non Uber One */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
                    Standard
                  </span>
                  <span className="text-2xl font-bold text-muted-foreground">
                    {globalStats.nonUberOnePercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-muted-foreground/50 rounded-full transition-all duration-500"
                    style={{ width: `${globalStats.nonUberOnePercent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>{globalStats.nonUberOneCount.toLocaleString("fr-FR")} commandes</span>
                </div>
              </div>

              {/* Total */}
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total commandes</span>
                  <span className="font-semibold">{globalStats.totalOrders.toLocaleString("fr-FR")}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evolution Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Évolution % Uber One</CardTitle>
              {canShowDetailed && (
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className={`h-7 px-2 ${chartMode === "average" ? "bg-background shadow-sm" : ""}`}
                          onClick={() => setChartMode("average")}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Moyenne réseau</TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className={`h-7 px-2 ${chartMode === "detailed" ? "bg-background shadow-sm" : ""}`}
                          onClick={() => setChartMode("detailed")}
                        >
                          <LineChartIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Par restaurant</TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(chartMode === "average" ? evolution.length > 1 : evolutionByRestaurant.length > 1) ? (
              <ChartContainer config={evolutionChartConfig} className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={chartMode === "average" ? evolution : evolutionByRestaurant} 
                    margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={evolutionYDomain}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={45}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => {
                            const label = chartMode === "average" 
                              ? "% Uber One" 
                              : (restaurantMap[name as string] ? getShortName(restaurantMap[name as string]) : name);
                            return [`${Number(value).toFixed(1)}%`, label];
                          }}
                        />
                      }
                    />
                    {chartMode === "average" ? (
                      <Line
                        type="monotone"
                        dataKey="uberOnePercent"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={3}
                        dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: "hsl(var(--chart-1))" }}
                      />
                    ) : (
                      byRestaurant.map((restaurant) => (
                        <Line
                          key={restaurant.restaurantId}
                          type="monotone"
                          dataKey={restaurant.restaurantId}
                          name={restaurant.restaurantId}
                          stroke={restaurantColorMap[restaurant.restaurantId]}
                          strokeWidth={2}
                          dot={{ fill: restaurantColorMap[restaurant.restaurantId], r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))
                    )}
                    {chartMode === "detailed" && (
                      <Legend
                        formatter={(value) => {
                          const name = restaurantMap[value];
                          return name ? getShortName(name) : value;
                        }}
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Pas assez de données pour afficher l'évolution
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Behavior Comparison Table - Full Width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Comportement comparé</CardTitle>
        </CardHeader>
        <CardContent>
          {comparison.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Métrique</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Crown className="h-4 w-4 text-amber-500" />
                      Uber One
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Standard</TableHead>
                  <TableHead className="text-right">Différence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.map((row) => (
                  <TableRow key={row.metric}>
                    <TableCell className="font-medium">{row.metric}</TableCell>
                    <TableCell className="text-right font-semibold text-chart-1">
                      {formatValue(row.uberOneValue, row.unit)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatValue(row.nonUberOneValue, row.unit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {getDiffIcon(row.differencePercent)}
                        <Badge
                          variant={
                            row.differencePercent > 0
                              ? "default"
                              : row.differencePercent < 0
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {row.differencePercent > 0 ? "+" : ""}
                          {row.differencePercent.toFixed(1)}%
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              Aucune donnée de comparaison
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simplified Restaurant Ranking List */}
      {byRestaurant.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Classement par restaurant</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleSort("name")}>
                  Nom <SortIcon field="name" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleSort("uberOnePct")}>
                  % UO <SortIcon field="uberOnePct" />
                </Button>
              </div>
              </div>
          </CardHeader>
          <CardContent>
            {byRestaurant.filter(r => !r.isSignificant).length > byRestaurant.length / 2 && (
              <Alert variant="default" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Données insuffisantes sur cette période (&lt;{SIGNIFICANCE_THRESHOLD} commandes). Les pourcentages peuvent être peu représentatifs.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-1">
              {sortedRestaurants.map((r) => (
                <button
                  key={r.restaurantId}
                  onClick={() => setSelectedRestaurant(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
                >
                  <span className="text-sm font-medium w-[200px] shrink-0 truncate flex items-center gap-1.5">
                    {!r.isSignificant && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                    {getShortName(r.restaurantName)}
                  </span>
                  <Progress value={r.uberOnePercent} className="h-2.5 flex-1 bg-muted" />
                  <span className="text-sm font-semibold tabular-nums min-w-[52px] text-right">
                    {r.uberOnePercent.toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restaurant Detail Sheet */}
      <Sheet open={!!selectedRestaurant} onOpenChange={(open) => !open && setSelectedRestaurant(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedRestaurant && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{selectedRestaurant.restaurantName}</SheetTitle>
                {!selectedRestaurant.isSignificant && (
                  <Badge variant="outline" className="w-fit text-amber-600 border-amber-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    &lt;{SIGNIFICANCE_THRESHOLD} commandes
                  </Badge>
                )}
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* % Uber One with large progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">% Uber One</span>
                    <span className="text-2xl font-bold text-chart-1">{selectedRestaurant.uberOnePercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={selectedRestaurant.uberOnePercent} className="h-4 bg-muted" />
                </div>

                {/* Volume */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Volume</h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-amber-500" /> Uber One
                    </span>
                    <span className="text-right font-semibold tabular-nums">{selectedRestaurant.uberOneCount.toLocaleString("fr-FR")}</span>
                    <span className="text-muted-foreground">Standard</span>
                    <span className="text-right tabular-nums text-muted-foreground">{selectedRestaurant.nonUberOneCount.toLocaleString("fr-FR")}</span>
                    <span className="font-medium">Total</span>
                    <span className="text-right font-semibold tabular-nums">{selectedRestaurant.totalOrders.toLocaleString("fr-FR")}</span>
                  </div>
                </div>

                {/* Panier moyen */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Panier moyen</h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-amber-500" /> Uber One
                    </span>
                    <span className="text-right font-semibold tabular-nums">{selectedRestaurant.uberOneBasket.toFixed(2)} €</span>
                    <span className="text-muted-foreground">Standard</span>
                    <span className="text-right tabular-nums text-muted-foreground">{selectedRestaurant.nonUberOneBasket.toFixed(2)} €</span>
                  </div>
                  {selectedRestaurant.nonUberOneBasket > 0 && (() => {
                    const diff = ((selectedRestaurant.uberOneBasket - selectedRestaurant.nonUberOneBasket) / selectedRestaurant.nonUberOneBasket) * 100;
                    return (
                      <div className="flex items-center gap-2 pt-1">
                        {getDiffIcon(diff)}
                        <Badge variant={diff > 0 ? "default" : diff < 0 ? "destructive" : "secondary"} className="text-xs">
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">vs Standard</span>
                      </div>
                    );
                  })()}
                </div>

                {/* CA estimé */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">CA estimé</h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-amber-500" /> Uber One
                    </span>
                    <span className="text-right font-semibold tabular-nums">
                      {(selectedRestaurant.uberOneBasket * selectedRestaurant.uberOneCount).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                    </span>
                    <span className="text-muted-foreground">Standard</span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {(selectedRestaurant.nonUberOneBasket * selectedRestaurant.nonUberOneCount).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}