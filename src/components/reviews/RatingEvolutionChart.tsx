import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, LineChart as LineChartIcon, Zap, ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  LineChart,
  Line,
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell
} from "recharts";
import { useMemo, useState, useRef } from "react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parse } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface MonthlyRating {
  month: string;
  rating: number | null;
  count: number;
  previousRating?: number | null;
  previousCount?: number;
  monthIndex?: number;
  year?: number;
}

interface Action {
  id: string;
  title: string;
  start_date: string;
  category: string;
}

interface RatingEvolutionChartProps {
  data: MonthlyRating[];
  actions?: Action[];
  showActions?: boolean;
  onToggleActions?: () => void;
  periodMode?: "year" | "month";
  selectedMonth?: number;
  selectedYear?: number;
  onDrillDown?: (month: number, year: number) => void;
  onBackToYear?: () => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  chartType?: "line" | "bar";
  onChartTypeChange?: (type: "line" | "bar") => void;
  onAddAction?: (date: Date) => void;
}

export function RatingEvolutionChart({ 
  data, 
  actions = [], 
  showActions = true, 
  onToggleActions,
  periodMode = "year",
  selectedMonth,
  selectedYear,
  onDrillDown,
  onBackToYear,
  onPrevMonth,
  onNextMonth,
  chartType = "line",
  onChartTypeChange,
  onAddAction
}: RatingEvolutionChartProps) {

  // State for context menu
  const [contextMenuDate, setContextMenuDate] = useState<Date | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Format month title for drill-down header
  const monthTitle = useMemo(() => {
    if (periodMode === "month" && selectedMonth && selectedYear) {
      const date = new Date(selectedYear, selectedMonth - 1, 1);
      return format(date, "MMMM yyyy", { locale: fr });
    }
    return "";
  }, [periodMode, selectedMonth, selectedYear]);

  // Handle click on chart data point for drill-down
  const handleChartClick = (chartData: any) => {
    if (!onDrillDown || periodMode === "month") return;
    
    if (chartData && chartData.activePayload && chartData.activePayload[0]) {
      const payload = chartData.activePayload[0].payload;
      if (payload.monthIndex !== undefined && payload.year !== undefined) {
        onDrillDown(payload.monthIndex + 1, payload.year);
      }
    }
  };

  // Extract date from chart data point for context menu
  const getDateFromPayload = (payload: any): Date | null => {
    if (!payload) return null;
    
    // For daily data (has year and monthIndex with a day in month field)
    if (payload.year !== undefined && payload.monthIndex !== undefined) {
      // Check if month is a day number (for month drill-down view)
      const dayNum = parseInt(payload.month);
      if (!isNaN(dayNum) && selectedMonth && selectedYear) {
        return new Date(selectedYear, selectedMonth - 1, dayNum);
      }
      // Try to parse "d MMM" format for quick period daily views
      try {
        const parsed = parse(payload.month, "d MMM", new Date(), { locale: fr });
        if (!isNaN(parsed.getTime())) {
          parsed.setFullYear(payload.year);
          return parsed;
        }
      } catch {}
      // For monthly view, return first day of month
      return new Date(payload.year, payload.monthIndex, 1);
    }
    return null;
  };

  // Handle right-click to capture the clicked data point
  const handleContextMenu = (e: any) => {
    if (e && e.activePayload && e.activePayload[0]) {
      const date = getDateFromPayload(e.activePayload[0].payload);
      setContextMenuDate(date);
    }
  };

  // Handle adding action from context menu
  const handleAddAction = () => {
    if (contextMenuDate && onAddAction) {
      onAddAction(contextMenuDate);
    }
  };

  // Calculate Y-axis for daily ratings (left axis) - standard 0-5 scale
  const { yMin, yMax, ticks } = useMemo(() => {
    return { yMin: 0, yMax: 5, ticks: [0, 1, 2, 3, 4, 5] };
  }, []);

  // Calculate dedicated Y-axis for cumulative average (right axis) - tight scale for visibility
  const { yMinCumulative, yMaxCumulative, ticksCumulative } = useMemo(() => {
    const cumulativeValues = data
      .map(d => (d as any).cumulativeAvg)
      .filter((v): v is number => v !== null && v !== undefined && v > 0);
    
    if (!cumulativeValues.length) {
      return { yMinCumulative: 0, yMaxCumulative: 5, ticksCumulative: [0, 1, 2, 3, 4, 5] };
    }
    
    const minAvg = Math.min(...cumulativeValues);
    const maxAvg = Math.max(...cumulativeValues);
    
    // Create a very tight scale with 0.2 margin to emphasize small variations
    const calculatedMin = Math.max(0, Math.floor((minAvg - 0.2) * 10) / 10);
    const calculatedMax = Math.min(5, Math.ceil((maxAvg + 0.2) * 10) / 10);
    
    // Generate ticks every 0.1 points for fine-grained visibility of thresholds
    const tickList: number[] = [];
    for (let t = calculatedMin; t <= calculatedMax + 0.01; t += 0.1) {
      tickList.push(Math.round(t * 100) / 100);
    }
    
    return { yMinCumulative: calculatedMin, yMaxCumulative: calculatedMax, ticksCumulative: tickList };
  }, [data]);

  // Calculate latest average and its variation for the header indicator
  const { latestAvg, avgVariation } = useMemo(() => {
    const dataWithAvg = data.filter(d => (d as any).cumulativeAvg !== null && (d as any).cumulativeAvg !== undefined);
    if (dataWithAvg.length < 2) return { latestAvg: null, avgVariation: null };
    
    const latest = (dataWithAvg[dataWithAvg.length - 1] as any).cumulativeAvg;
    // Compare with value from 7 days/points ago
    const comparisonIndex = Math.max(0, dataWithAvg.length - 8);
    const previous = (dataWithAvg[comparisonIndex] as any).cumulativeAvg;
    
    return {
      latestAvg: latest,
      avgVariation: previous ? latest - previous : null
    };
  }, [data]);

  // Get actions by month for markers (year view)
  const actionsByMonth = useMemo(() => {
    const map = new Map<string, Action[]>();
    actions.forEach(action => {
      const date = new Date(action.start_date);
      const monthKey = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      const existing = map.get(monthKey) || [];
      map.set(monthKey, [...existing, action]);
    });
    return map;
  }, [actions]);

  // Get actions by day for markers (month drill-down view)
  const actionsByDay = useMemo(() => {
    if (periodMode !== "month" || !selectedMonth || !selectedYear) return new Map<string, Action[]>();
    
    const map = new Map<string, Action[]>();
    actions.forEach(action => {
      const date = new Date(action.start_date);
      // Only include actions from the selected month/year
      if (date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear) {
        const dayKey = String(date.getDate()); // "2" for 2nd of month
        const existing = map.get(dayKey) || [];
        map.set(dayKey, [...existing, action]);
      }
    });
    return map;
  }, [actions, periodMode, selectedMonth, selectedYear]);

  // Get bar color based on rating value
  const getBarColor = (rating: number) => {
    if (rating >= 4.5) return "hsl(var(--chart-2))"; // emerald
    if (rating >= 3.5) return "hsl(45 93% 47%)"; // amber
    return "hsl(0 84% 60%)"; // red
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const current = payload.find((p: any) => p.dataKey === "rating");
      const previous = payload.find((p: any) => p.dataKey === "previousRating");
      const cumulative = payload.find((p: any) => p.dataKey === "cumulativeAvg");
      // Use day-based lookup for month drill-down view, month-based for year view
      const actionsForLabel = periodMode === "month" 
        ? actionsByDay.get(label) || []
        : actionsByMonth.get(label) || [];
      const reviewCount = payload[0]?.payload?.count || 0;

      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">{label}</p>
          {reviewCount === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun avis ce jour</p>
          ) : (
            <>
              {current && current.value !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Note du jour: <strong>{current.value?.toFixed(2)}</strong></span>
                  <span className="text-muted-foreground">({reviewCount} avis)</span>
                </div>
              )}
              {cumulative?.value && cumulative.value !== null && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span>Moyenne globale: <strong>{cumulative.value?.toFixed(2)}</strong></span>
                </div>
              )}
              {previous?.value && previous.value !== null && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
                  <span>N-1: <strong>{previous.value?.toFixed(2)}</strong></span>
                  {current?.value !== null && (
                    <span className={current.value > previous.value ? "text-emerald-500" : "text-red-500"}>
                      ({current.value > previous.value ? "+" : ""}{(current.value - previous.value).toFixed(2)} pts)
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          {showActions && actionsForLabel.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">
                {periodMode === "month" ? "Actions ce jour:" : "Actions ce mois:"}
              </p>
              {actionsForLabel.slice(0, 3).map(action => (
                <div key={action.id} className="flex items-center gap-1 text-xs">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span className="truncate max-w-[200px]">{action.title}</span>
                </div>
              ))}
              {actionsForLabel.length > 3 && (
                <p className="text-xs text-muted-foreground">+{actionsForLabel.length - 3} autres...</p>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom dot for line chart with action markers
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    
    // Use day-based lookup for month drill-down view, month-based for year view
    const actionsForPoint = periodMode === "month" 
      ? actionsByDay.get(payload.month) || []
      : actionsByMonth.get(payload.month) || [];
    const hasActions = showActions && actionsForPoint.length > 0;

    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="hsl(45 93% 47%)"
          stroke="hsl(var(--background))"
          strokeWidth={2}
        />
        {hasActions && (
          <g>
            <circle cx={cx} cy={cy - 15} r={8} fill="hsl(var(--primary))" />
            <text x={cx} y={cy - 11} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold">
              ⚡
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {periodMode === "month" && onBackToYear && (
            <>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={onBackToYear} className="h-8 w-8 p-0">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Retour vue annuelle</TooltipContent>
                </UITooltip>
              </TooltipProvider>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={onPrevMonth} className="h-8 w-8 p-0">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mois précédent</TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </>
          )}
          <div className="flex items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              {periodMode === "month" ? (
                <span className="capitalize">{monthTitle}</span>
              ) : (
                "Évolution de la Note Moyenne"
              )}
            </CardTitle>
            {latestAvg !== null && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <span className="text-lg font-bold text-primary">{latestAvg.toFixed(2)}</span>
                {avgVariation !== null && (
                  <span className={`text-sm font-medium ${avgVariation >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {avgVariation >= 0 ? "▲" : "▼"} {Math.abs(avgVariation).toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
          {periodMode === "month" && onNextMonth && (
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onNextMonth} className="h-8 w-8 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mois suivant</TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex gap-1">
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={chartType === "line" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChartTypeChange?.("line")}
                  className="h-8 w-8 p-0"
                >
                  <LineChartIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Graphique ligne</TooltipContent>
            </UITooltip>
          </TooltipProvider>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={chartType === "bar" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChartTypeChange?.("bar")}
                  className="h-8 w-8 p-0"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Graphique barres</TooltipContent>
            </UITooltip>
          </TooltipProvider>
          {onToggleActions && (
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showActions ? "default" : "outline"}
                    size="sm"
                    onClick={onToggleActions}
                    className="h-8 w-8 p-0"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Afficher les actions</TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div ref={chartRef}>
              <ResponsiveContainer width="100%" height={300}>
                {chartType === "line" ? (
                  <LineChart 
                    data={data} 
                    margin={{ top: 20, right: 50, left: 0, bottom: 0 }}
                    onClick={handleChartClick}
                    onMouseMove={handleContextMenu}
                    style={{ cursor: periodMode === "year" && onDrillDown ? "pointer" : "default" }}
                  >
                    {/* Performance zones on left axis */}
                    <ReferenceArea yAxisId="left" y1={4.5} y2={5} fill="hsl(var(--chart-2))" fillOpacity={0.1} />
                    <ReferenceArea yAxisId="left" y1={3.5} y2={4.5} fill="hsl(45 93% 47%)" fillOpacity={0.05} />
                    <ReferenceArea yAxisId="left" y1={0} y2={3.5} fill="hsl(0 84% 60%)" fillOpacity={0.05} />

                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 11 }} 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    
                    {/* Left Y-axis: Daily ratings (0-5 scale) */}
                    <YAxis 
                      yAxisId="left"
                      domain={[yMin, yMax]} 
                      ticks={ticks}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => value.toFixed(0)}
                    />
                    
                    {/* Right Y-axis: Cumulative average (tight scale for visibility) */}
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      domain={[yMinCumulative, yMaxCumulative]} 
                      ticks={ticksCumulative}
                      tick={{ fontSize: 10, fill: "hsl(var(--primary))" }}
                      stroke="hsl(var(--primary))"
                      tickFormatter={(value) => value.toFixed(1)}
                    />
                    
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* N-1 line on left axis */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="previousRating"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      connectNulls
                    />
                    
                    {/* Current line (daily rating) on left axis */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="rating"
                      stroke="hsl(45 93% 47%)"
                      strokeWidth={3}
                      dot={<CustomDot />}
                      activeDot={{ r: 7, strokeWidth: 0 }}
                      connectNulls={true}
                      name="Note du jour"
                    />
                    
                    {/* Shaded area under cumulative average on right axis */}
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativeAvg"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.15}
                      stroke="none"
                      connectNulls={true}
                    />
                    
                    {/* Cumulative average line on right axis - thicker for visibility */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativeAvg"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={false}
                      connectNulls={true}
                      name="Moyenne globale"
                    />

                    {/* Reference lines on left axis */}
                    <ReferenceLine yAxisId="left" y={4.5} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine yAxisId="left" y={3.5} stroke="hsl(45 93% 47%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                    
                    {/* Vertical dashed lines for actions */}
                    {showActions && (periodMode === "month" 
                      ? Array.from(actionsByDay.keys()).map(day => (
                          <ReferenceLine 
                            key={`action-line-${day}`}
                            yAxisId="left"
                            x={day} 
                            stroke="hsl(var(--primary))" 
                            strokeDasharray="4 4" 
                            strokeOpacity={0.6}
                          />
                        ))
                      : Array.from(actionsByMonth.keys()).map(month => (
                          <ReferenceLine 
                            key={`action-line-${month}`}
                            yAxisId="left"
                            x={month} 
                            stroke="hsl(var(--primary))" 
                            strokeDasharray="4 4" 
                            strokeOpacity={0.6}
                          />
                        ))
                    )}
                  </LineChart>
                ) : (
                  <ComposedChart 
                    data={data} 
                    margin={{ top: 20, right: 50, left: 0, bottom: 0 }}
                    onClick={handleChartClick}
                    onMouseMove={handleContextMenu}
                    style={{ cursor: periodMode === "year" && onDrillDown ? "pointer" : "default" }}
                  >
                    {/* Performance zones on left axis */}
                    <ReferenceArea yAxisId="left" y1={4.5} y2={5} fill="hsl(var(--chart-2))" fillOpacity={0.1} />
                    <ReferenceArea yAxisId="left" y1={3.5} y2={4.5} fill="hsl(45 93% 47%)" fillOpacity={0.05} />
                    <ReferenceArea yAxisId="left" y1={0} y2={3.5} fill="hsl(0 84% 60%)" fillOpacity={0.05} />

                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 11 }} 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    
                    {/* Left Y-axis: Daily ratings (0-5 scale) */}
                    <YAxis 
                      yAxisId="left"
                      domain={[yMin, yMax]} 
                      ticks={ticks}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => value.toFixed(0)}
                    />
                    
                    {/* Right Y-axis: Cumulative average (tight scale) */}
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      domain={[yMinCumulative, yMaxCumulative]} 
                      ticks={ticksCumulative}
                      tick={{ fontSize: 10, fill: "hsl(var(--primary))" }}
                      stroke="hsl(var(--primary))"
                      tickFormatter={(value) => value.toFixed(1)}
                    />
                    
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Previous period bars (ghost) on left axis */}
                    <Bar
                      yAxisId="left"
                      dataKey="previousRating"
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.3}
                      radius={[4, 4, 0, 0]}
                    />
                    
                    {/* Current period bars with dynamic colors on left axis */}
                    <Bar
                      yAxisId="left"
                      dataKey="rating"
                      radius={[4, 4, 0, 0]}
                    >
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.rating)} />
                      ))}
                    </Bar>

                    {/* Reference lines on left axis */}
                    <ReferenceLine yAxisId="left" y={4.5} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine yAxisId="left" y={3.5} stroke="hsl(45 93% 47%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                    
                    {/* Vertical dashed lines for actions */}
                    {showActions && (periodMode === "month" 
                      ? Array.from(actionsByDay.keys()).map(day => (
                          <ReferenceLine 
                            key={`action-line-${day}`}
                            yAxisId="left"
                            x={day} 
                            stroke="hsl(var(--primary))" 
                            strokeDasharray="4 4" 
                            strokeOpacity={0.6}
                          />
                        ))
                      : Array.from(actionsByMonth.keys()).map(month => (
                          <ReferenceLine 
                            key={`action-line-${month}`}
                            yAxisId="left"
                            x={month} 
                            stroke="hsl(var(--primary))" 
                            strokeDasharray="4 4" 
                            strokeOpacity={0.6}
                          />
                        ))
                    )}
                    
                    {/* Shaded area under rolling 90-day average on right axis */}
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativeAvg"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.15}
                      stroke="none"
                      connectNulls={true}
                    />
                    
                    {/* Rolling 90-day average line overlay on right axis */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativeAvg"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={false}
                      connectNulls={true}
                      name="Moyenne globale"
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56">
            {onAddAction && contextMenuDate && (
              <ContextMenuItem onClick={handleAddAction} className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter une action pour le {format(contextMenuDate, "d MMMM yyyy", { locale: fr })}
              </ContextMenuItem>
            )}
            {(!onAddAction || !contextMenuDate) && (
              <ContextMenuItem disabled className="text-muted-foreground">
                Survolez un point pour ajouter une action
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-amber-500" />
            <span className="text-muted-foreground">Note du jour</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-primary" />
            <span className="text-muted-foreground">Moyenne globale</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50" />
            <span className="text-muted-foreground">Excellent (≥4.5)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50" />
            <span className="text-muted-foreground">Bon (3.5-4.5)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50" />
            <span className="text-muted-foreground">À améliorer (&lt;3.5)</span>
          </div>
          {showActions && actions.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <Zap className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
              <span className="text-muted-foreground">Actions</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
