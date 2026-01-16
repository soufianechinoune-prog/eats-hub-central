import { useMemo, useState } from "react";
import { format, eachDayOfInterval, subYears, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from "recharts";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Percent, BarChart3, TrendingUp, LayoutList, ChartArea,
  ArrowUp, ArrowDown, Minus, Download, ArrowLeftRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as XLSX from "xlsx";

interface DailyProfitabilityRow {
  restaurant_id: string;
  day: string;
  sales: number;
  payout: number;
  orders_count: number;
}

interface ProfitabilityComparisonChartProps {
  currentPeriodData: DailyProfitabilityRow[];
  previousPeriodData: DailyProfitabilityRow[];
  dateRange: { start: Date; end: Date };
  previousDateRange: { start: Date; end: Date };
  isLoading?: boolean;
  comparisonMode?: "yearOverYear" | "rollingPeriod";
  onComparisonModeChange?: (mode: "yearOverYear" | "rollingPeriod") => void;
}

type ViewMode = "chart" | "table";
type ChartType = "bar" | "line";

// Calculate variation
const calcVariation = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return current - previous; // Points de pourcentage
};

// Variation cell component
function VariationCell({ current, previous, suffix = "pp" }: { current: number; previous: number; suffix?: string }) {
  const variation = calcVariation(current, previous);
  if (variation === null) return <span className="text-muted-foreground">--</span>;
  const isPositive = variation > 0;
  const isNeutral = Math.abs(variation) < 0.5;
  return (
    <span className={cn(
      "flex items-center gap-0.5 font-medium", 
      isNeutral ? "text-muted-foreground" : isPositive ? "text-emerald-600" : "text-red-600"
    )}>
      {isNeutral ? <Minus className="h-3.5 w-3.5" /> : isPositive ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {variation > 0 ? "+" : ""}{variation.toFixed(1)}{suffix}
    </span>
  );
}

export const ProfitabilityComparisonChart = ({
  currentPeriodData,
  previousPeriodData,
  dateRange,
  previousDateRange,
  isLoading,
  comparisonMode = "yearOverYear",
  onComparisonModeChange,
}: ProfitabilityComparisonChartProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [chartType, setChartType] = useState<ChartType>("bar");

  // Aggregate data by day
  const chartData = useMemo(() => {
    const allDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    
    // Aggregate current period by day
    const currentByDay: Record<string, { sales: number; payout: number; orders: number }> = {};
    currentPeriodData.forEach(row => {
      if (!currentByDay[row.day]) {
        currentByDay[row.day] = { sales: 0, payout: 0, orders: 0 };
      }
      currentByDay[row.day].sales += Number(row.sales) || 0;
      currentByDay[row.day].payout += Number(row.payout) || 0;
      currentByDay[row.day].orders += Number(row.orders_count) || 0;
    });
    
    // Aggregate previous period by day
    const prevByDay: Record<string, { sales: number; payout: number; orders: number }> = {};
    previousPeriodData.forEach(row => {
      if (!prevByDay[row.day]) {
        prevByDay[row.day] = { sales: 0, payout: 0, orders: 0 };
      }
      prevByDay[row.day].sales += Number(row.sales) || 0;
      prevByDay[row.day].payout += Number(row.payout) || 0;
      prevByDay[row.day].orders += Number(row.orders_count) || 0;
    });
    
    // Build aligned chart data
    return allDays.map((day, index) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const current = currentByDay[dateStr] || { sales: 0, payout: 0, orders: 0 };
      
      // Calculate previous date based on comparison mode
      let prevDateStr: string;
      if (comparisonMode === "rollingPeriod") {
        const prevDay = subWeeks(day, 4);
        prevDateStr = format(prevDay, "yyyy-MM-dd");
      } else {
        const prevDay = subYears(day, 1);
        prevDateStr = format(prevDay, "yyyy-MM-dd");
      }
      const previous = prevByDay[prevDateStr] || { sales: 0, payout: 0, orders: 0 };
      
      const profitability = current.sales > 0 ? (current.payout / current.sales) * 100 : null;
      const prevProfitability = previous.sales > 0 ? (previous.payout / previous.sales) * 100 : null;
      
      return {
        date: dateStr,
        dateLabel: format(day, "d MMM", { locale: fr }),
        dayOfWeek: format(day, "EEE", { locale: fr }),
        profitability,
        prevProfitability,
        sales: current.sales,
        payout: current.payout,
        orders: current.orders,
        prevSales: previous.sales,
        prevPayout: previous.payout,
        prevOrders: previous.orders,
        currentDate: dateStr,
        prevDate: prevDateStr,
      };
    });
  }, [currentPeriodData, previousPeriodData, dateRange, comparisonMode]);

  // Calculate totals and KPIs
  const { totalProfitability, prevTotalProfitability, variation, totalSales, prevTotalSales } = useMemo(() => {
    const totalSales = chartData.reduce((sum, d) => sum + (d.sales || 0), 0);
    const totalPayout = chartData.reduce((sum, d) => sum + (d.payout || 0), 0);
    const prevTotalSales = chartData.reduce((sum, d) => sum + (d.prevSales || 0), 0);
    const prevTotalPayout = chartData.reduce((sum, d) => sum + (d.prevPayout || 0), 0);
    
    const totalProfitability = totalSales > 0 ? (totalPayout / totalSales) * 100 : 0;
    const prevTotalProfitability = prevTotalSales > 0 ? (prevTotalPayout / prevTotalSales) * 100 : 0;
    const variation = totalProfitability - prevTotalProfitability;
    
    return { totalProfitability, prevTotalProfitability, variation, totalSales, prevTotalSales };
  }, [chartData]);

  // Period labels
  const currentLabel = comparisonMode === "rollingPeriod" 
    ? "Actuel" 
    : format(dateRange.start, "MMM yyyy", { locale: fr });
  const prevLabel = comparisonMode === "rollingPeriod" 
    ? "-4 sem." 
    : format(previousDateRange.start, "MMM yyyy", { locale: fr });

  // Check if we have previous data
  const hasPrevData = prevTotalSales > 0;

  // Dynamic Y-axis domain
  const { minY, maxY } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    chartData.forEach(d => {
      if (d.profitability !== null) {
        min = Math.min(min, d.profitability);
        max = Math.max(max, d.profitability);
      }
      if (d.prevProfitability !== null) {
        min = Math.min(min, d.prevProfitability);
        max = Math.max(max, d.prevProfitability);
      }
    });
    if (min === Infinity || max === -Infinity) {
      return { minY: 50, maxY: 80 };
    }
    const margin = (max - min) * 0.15 || 5;
    return { 
      minY: Math.floor(Math.max(0, min - margin)), 
      maxY: Math.ceil(Math.min(100, max + margin)) 
    };
  }, [chartData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    const data = payload[0]?.payload;
    if (!data) return null;
    
    const profitability = data.profitability;
    const prevProfitability = data.prevProfitability;
    const diff = profitability !== null && prevProfitability !== null 
      ? profitability - prevProfitability 
      : null;
    const diffColor = diff !== null 
      ? (diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-muted-foreground")
      : "";
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm min-w-[200px]">
        <p className="font-semibold mb-2">{data.dayOfWeek}. {label}</p>
        
        <div className="space-y-1.5">
          {/* Current */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-muted-foreground">{currentLabel}</span>
            </div>
            <span className="font-semibold text-emerald-600">
              {profitability !== null ? `${profitability.toFixed(1)}%` : "--"}
            </span>
          </div>
          
          {/* Previous */}
          {hasPrevData && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-muted-foreground/50" />
                <span className="text-muted-foreground">{prevLabel}</span>
              </div>
              <span className="text-muted-foreground">
                {prevProfitability !== null ? `${prevProfitability.toFixed(1)}%` : "--"}
              </span>
            </div>
          )}
          
          {/* Variation */}
          {diff !== null && (
            <div className="pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Variation</span>
                <span className={cn("font-semibold", diffColor)}>
                  {diff > 0 ? "+" : ""}{diff.toFixed(1)}pp
                </span>
              </div>
            </div>
          )}
          
          {/* Details */}
          <div className="pt-2 border-t border-border text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Ventes</span>
              <span>{data.sales?.toLocaleString("fr-FR")} €</span>
            </div>
            <div className="flex justify-between">
              <span>Payout</span>
              <span>{data.payout?.toLocaleString("fr-FR")} €</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = chartData.map(row => ({
      "Date": row.dateLabel,
      "Jour": row.dayOfWeek,
      [`Rentabilité ${currentLabel}`]: row.profitability?.toFixed(1) || "--",
      ...(hasPrevData ? { 
        [`Rentabilité ${prevLabel}`]: row.prevProfitability?.toFixed(1) || "--",
        "Variation (pp)": row.profitability !== null && row.prevProfitability !== null 
          ? (row.profitability - row.prevProfitability).toFixed(1) 
          : "--"
      } : {}),
      "Ventes": row.sales,
      "Payout": row.payout,
      "Commandes": row.orders,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rentabilité");
    XLSX.writeFile(wb, `rentabilite_${format(dateRange.start, "yyyy-MM")}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with KPIs and controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Icon + title + KPIs */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-emerald-500" />
            <span className="font-semibold">Rentabilité globale</span>
          </div>
          
          {/* KPIs inline */}
          <div className="flex items-center gap-3 text-sm">
            <div className="px-3 py-1.5 bg-emerald-500/10 rounded-lg">
              <span className="font-bold text-emerald-600">{totalProfitability.toFixed(1)}%</span>
            </div>
            {hasPrevData && (
              <>
                <span className="text-muted-foreground">vs</span>
                <div className="px-3 py-1.5 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">{prevTotalProfitability.toFixed(1)}%</span>
                </div>
                <div className={cn(
                  "px-3 py-1.5 rounded-lg font-semibold",
                  variation > 0 ? "bg-emerald-500/10 text-emerald-600" : 
                  variation < 0 ? "bg-red-500/10 text-red-600" : "bg-muted/50 text-muted-foreground"
                )}>
                  {variation > 0 ? "+" : ""}{variation.toFixed(1)}pp
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <Button 
              variant={viewMode === 'chart' ? 'secondary' : 'ghost'} 
              size="sm"
              className="h-7 px-2 gap-1"
              onClick={() => setViewMode('chart')}
            >
              <ChartArea className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Graphique</span>
            </Button>
            <Button 
              variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
              size="sm"
              className="h-7 px-2 gap-1"
              onClick={() => setViewMode('table')}
            >
              <LayoutList className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Tableau</span>
            </Button>
          </div>
          
          {/* Chart type toggle (only in chart mode) */}
          {viewMode === 'chart' && (
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <Button 
                variant={chartType === 'bar' ? 'secondary' : 'ghost'} 
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setChartType('bar')}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button 
                variant={chartType === 'line' ? 'secondary' : 'ghost'} 
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setChartType('line')}
              >
                <TrendingUp className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Rolling period toggle */}
          {onComparisonModeChange && (
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={comparisonMode === 'rollingPeriod' ? 'default' : 'outline'} 
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 transition-all",
                      comparisonMode === 'rollingPeriod' && "bg-amber-600 hover:bg-amber-700 text-white border-0"
                    )}
                    onClick={() => {
                      const newMode = comparisonMode === 'rollingPeriod' ? 'yearOverYear' : 'rollingPeriod';
                      onComparisonModeChange(newMode);
                    }}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    <span className="text-xs">4 sem.</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">Période glissante</p>
                  <p className="text-xs text-muted-foreground">Comparer avec 4 semaines avant (même jour)</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
          
          {/* Export */}
          {viewMode === 'table' && (
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 h-8">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}
        </div>
      </div>
      
      {/* Chart */}
      {viewMode === 'chart' && (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="dateLabel" 
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={[minY, maxY]}
                  className="text-xs"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Previous period bars (background) */}
                {hasPrevData && (
                  <Bar 
                    dataKey="prevProfitability" 
                    fill="hsl(var(--muted-foreground))" 
                    fillOpacity={0.3}
                    radius={[2, 2, 0, 0]}
                    name={prevLabel}
                  />
                )}
                
                {/* Current period bars */}
                <Bar 
                  dataKey="profitability" 
                  fill="hsl(142 71% 45%)"
                  radius={[4, 4, 0, 0]}
                  name={currentLabel}
                />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="dateLabel" 
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={[minY, maxY]}
                  className="text-xs"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Previous period line */}
                {hasPrevData && (
                  <Line 
                    type="monotone"
                    dataKey="prevProfitability" 
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                    dot={false}
                    name={prevLabel}
                    connectNulls
                  />
                )}
                
                {/* Current period line */}
                <Line 
                  type="monotone"
                  dataKey="profitability" 
                  stroke="hsl(142 71% 45%)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(142 71% 45%)" }}
                  activeDot={{ r: 5 }}
                  name={currentLabel}
                  connectNulls
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Table */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Rentabilité {currentLabel}</TableHead>
                {hasPrevData && (
                  <>
                    <TableHead className="text-right">Rentabilité {prevLabel}</TableHead>
                    <TableHead className="text-right">Variation</TableHead>
                  </>
                )}
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                <TableHead className="text-right">Commandes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{row.dayOfWeek}. {row.dateLabel}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">
                    {row.profitability !== null ? `${row.profitability.toFixed(1)}%` : "--"}
                  </TableCell>
                  {hasPrevData && (
                    <>
                      <TableCell className="text-right text-muted-foreground">
                        {row.prevProfitability !== null ? `${row.prevProfitability.toFixed(1)}%` : "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.profitability !== null && row.prevProfitability !== null ? (
                          <VariationCell current={row.profitability} previous={row.prevProfitability} />
                        ) : "--"}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right">{row.sales.toLocaleString("fr-FR")} €</TableCell>
                  <TableCell className="text-right">{row.payout.toLocaleString("fr-FR")} €</TableCell>
                  <TableCell className="text-right">{row.orders}</TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                <TableCell className="font-bold">TOTAL</TableCell>
                <TableCell className="text-right font-bold text-emerald-600">
                  {totalProfitability.toFixed(1)}%
                </TableCell>
                {hasPrevData && (
                  <>
                    <TableCell className="text-right text-muted-foreground font-semibold">
                      {prevTotalProfitability.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <VariationCell current={totalProfitability} previous={prevTotalProfitability} />
                    </TableCell>
                  </>
                )}
                <TableCell className="text-right font-bold">
                  {chartData.reduce((sum, d) => sum + d.sales, 0).toLocaleString("fr-FR")} €
                </TableCell>
                <TableCell className="text-right font-bold">
                  {chartData.reduce((sum, d) => sum + d.payout, 0).toLocaleString("fr-FR")} €
                </TableCell>
                <TableCell className="text-right font-bold">
                  {chartData.reduce((sum, d) => sum + d.orders, 0)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
