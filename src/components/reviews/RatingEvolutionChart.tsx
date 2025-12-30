import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, LineChart as LineChartIcon, Zap, ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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

  // Calculate dynamic Y-axis domain based on data
  const { yMin, yMax, ticks } = useMemo(() => {
    if (!data.length) return { yMin: 0, yMax: 5, ticks: [0, 1, 2, 3, 4, 5] };

    const ratings = data.map(d => d.rating).filter(r => r > 0);
    const previousRatings = data.map(d => d.previousRating).filter((r): r is number => r !== undefined && r > 0);
    const allRatings = [...ratings, ...previousRatings];

    if (!allRatings.length) return { yMin: 0, yMax: 5, ticks: [0, 1, 2, 3, 4, 5] };

    const minRating = Math.min(...allRatings);
    const maxRating = Math.max(...allRatings);

    // Dynamic scaling based on rating range
    if (minRating >= 4 && maxRating <= 5) {
      // High ratings: focus on 3.5-5 range
      return { yMin: 3.5, yMax: 5, ticks: [3.5, 4, 4.5, 5] };
    } else if (minRating >= 3.5 && maxRating <= 5) {
      // Good ratings: focus on 3-5 range
      return { yMin: 3, yMax: 5, ticks: [3, 3.5, 4, 4.5, 5] };
    } else if (minRating >= 3 && maxRating <= 5) {
      // Moderate ratings: 2.5-5 range
      return { yMin: 2.5, yMax: 5, ticks: [2.5, 3, 3.5, 4, 4.5, 5] };
    } else {
      // Low ratings or wide range: show full scale
      return { yMin: 0, yMax: 5, ticks: [0, 1, 2, 3, 4, 5] };
    }
  }, [data]);

  // Get actions by month for markers
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
      const monthActions = actionsByMonth.get(label) || [];
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
                  <span>Note actuelle: <strong>{current.value?.toFixed(2)}</strong></span>
                  <span className="text-muted-foreground">({reviewCount} avis)</span>
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
          {showActions && monthActions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Actions ce mois:</p>
              {monthActions.slice(0, 3).map(action => (
                <div key={action.id} className="flex items-center gap-1 text-xs">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span className="truncate max-w-[200px]">{action.title}</span>
                </div>
              ))}
              {monthActions.length > 3 && (
                <p className="text-xs text-muted-foreground">+{monthActions.length - 3} autres...</p>
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
    const monthActions = actionsByMonth.get(payload.month) || [];
    const hasActions = showActions && monthActions.length > 0;

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
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            {periodMode === "month" ? (
              <span className="capitalize">{monthTitle}</span>
            ) : (
              "Évolution de la Note Moyenne"
            )}
          </CardTitle>
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
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                    onClick={handleChartClick}
                    onMouseMove={handleContextMenu}
                    style={{ cursor: periodMode === "year" && onDrillDown ? "pointer" : "default" }}
                  >
                    {/* Performance zones - adjusted to dynamic scale */}
                    {yMin <= 4.5 && <ReferenceArea y1={Math.max(4.5, yMin)} y2={yMax} fill="hsl(var(--chart-2))" fillOpacity={0.1} />}
                    {yMin <= 3.5 && <ReferenceArea y1={Math.max(3.5, yMin)} y2={Math.min(4.5, yMax)} fill="hsl(45 93% 47%)" fillOpacity={0.05} />}
                    {yMin < 3.5 && <ReferenceArea y1={yMin} y2={Math.min(3.5, yMax)} fill="hsl(0 84% 60%)" fillOpacity={0.05} />}

                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 11 }} 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      domain={[yMin, yMax]} 
                      ticks={ticks}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => value.toFixed(1)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* N-1 line */}
                    <Line
                      type="monotone"
                      dataKey="previousRating"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      connectNulls
                    />
                    
                    {/* Current line */}
                    <Line
                      type="monotone"
                      dataKey="rating"
                      stroke="hsl(45 93% 47%)"
                      strokeWidth={3}
                      dot={<CustomDot />}
                      activeDot={{ r: 7, strokeWidth: 0 }}
                      connectNulls={true}
                    />

                    {/* Reference lines - only show if in visible range */}
                    {yMin <= 4.5 && yMax >= 4.5 && (
                      <ReferenceLine y={4.5} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    )}
                    {yMin <= 3.5 && yMax >= 3.5 && (
                      <ReferenceLine y={3.5} stroke="hsl(45 93% 47%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                    )}
                  </LineChart>
                ) : (
                  <BarChart 
                    data={data} 
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                    onClick={handleChartClick}
                    onMouseMove={handleContextMenu}
                    style={{ cursor: periodMode === "year" && onDrillDown ? "pointer" : "default" }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 11 }} 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      domain={[yMin, yMax]} 
                      ticks={ticks}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => value.toFixed(1)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Previous period bars (ghost) */}
                    <Bar
                      dataKey="previousRating"
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.3}
                      radius={[4, 4, 0, 0]}
                    />
                    
                    {/* Current period bars with dynamic colors */}
                    <Bar
                      dataKey="rating"
                      radius={[4, 4, 0, 0]}
                    >
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.rating)} />
                      ))}
                    </Bar>

                    {/* Reference lines */}
                    {yMin <= 4.5 && yMax >= 4.5 && (
                      <ReferenceLine y={4.5} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    )}
                    {yMin <= 3.5 && yMax >= 3.5 && (
                      <ReferenceLine y={3.5} stroke="hsl(45 93% 47%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                    )}
                  </BarChart>
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
        <div className="flex justify-center gap-6 mt-4 text-xs">
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
