import { useMemo, useState } from "react";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useUberOneStats, SIGNIFICANCE_THRESHOLD } from "@/hooks/useUberOneStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
type SortField = "name" | "uberOnePct" | "uberOneCount" | "nonUberOneCount" | "totalOrders" | "uberOneBasket" | "nonUberOneBasket";
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
  } = useAnalyticsContext();

  // Use selectedRestaurants for calculations (active chips = dark background)
  // Fallback to pinned restaurants via useUberOneStats when no selection
  const restaurantIdsForQuery = useMemo(() => {
    // Use selected restaurants (active ones)
    if (selectedRestaurants && selectedRestaurants.length > 0) {
      return selectedRestaurants;
    }
    // If no explicit selection, the hook useUberOneStats will use pinned as fallback
    return [];
  }, [selectedRestaurants]);

  const [chartMode, setChartMode] = useState<ChartMode>("average");
  const [sortField, setSortField] = useState<SortField>("uberOnePct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
    restaurantIds: restaurantIdsForQuery,
    startDate,
    endDate,
    periodMode,
    platform: selectedPlatform,
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
        case "uberOneCount": return mod * (a.uberOneCount - b.uberOneCount);
        case "nonUberOneCount": return mod * (a.nonUberOneCount - b.nonUberOneCount);
        case "totalOrders": return mod * (a.totalOrders - b.totalOrders);
        case "uberOneBasket": return mod * (a.uberOneBasket - b.uberOneBasket);
        case "nonUberOneBasket": return mod * (a.nonUberOneBasket - b.nonUberOneBasket);
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

      {/* Full-Width Restaurant Ranking Table */}
      {byRestaurant.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Classement par restaurant</CardTitle>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="flex items-center text-xs font-medium" onClick={() => toggleSort("name")}>
                        Restaurant <SortIcon field="name" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right min-w-[160px]">
                      <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("uberOnePct")}>
                        % Uber One <SortIcon field="uberOnePct" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("uberOneCount")}>
                        Cmd UO <SortIcon field="uberOneCount" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("nonUberOneCount")}>
                        Cmd Std <SortIcon field="nonUberOneCount" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("totalOrders")}>
                        Total <SortIcon field="totalOrders" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("uberOneBasket")}>
                        Panier UO <SortIcon field="uberOneBasket" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button className="flex items-center justify-end text-xs font-medium w-full" onClick={() => toggleSort("nonUberOneBasket")}>
                        Panier Std <SortIcon field="nonUberOneBasket" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRestaurants.map((r) => (
                    <TableRow key={r.restaurantId}>
                      <TableCell className="font-medium">
                        <TooltipProvider>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1.5">
                                {!r.isSignificant && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                                {getShortName(r.restaurantName)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{r.restaurantName}</TooltipContent>
                          </UITooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Progress 
                            value={r.uberOnePercent} 
                            className="h-2 w-16 bg-muted" 
                          />
                          <span className="font-semibold text-sm min-w-[48px] text-right">
                            {r.uberOnePercent.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.uberOneCount.toLocaleString("fr-FR")}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.nonUberOneCount.toLocaleString("fr-FR")}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{r.totalOrders.toLocaleString("fr-FR")}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.uberOneBasket.toFixed(2)} €</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.nonUberOneBasket.toFixed(2)} €</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}