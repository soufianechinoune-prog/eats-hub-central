import { useMemo, useState } from "react";
import { format, eachMonthOfInterval, eachDayOfInterval, startOfMonth, subYears, subWeeks, subDays, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from "recharts";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Percent, LayoutList, ChartArea,
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
  payout: number; // Total: net_payout + meal_voucher (backward compat)
  net_payout: number; // What Uber pays (without meal vouchers) - for Marge Uber
  meal_voucher: number; // External payment from Swile/Edenred
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
  onMonthClick?: (monthNum: number) => void;
}

type ViewMode = "chart" | "table";

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
  onMonthClick,
}: ProfitabilityComparisonChartProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("chart");

  // Detect if short period (≤ 45 days → show daily instead of monthly)
  const isShortPeriod = useMemo(() => {
    return differenceInDays(dateRange.end, dateRange.start) <= 45;
  }, [dateRange]);

  // Aggregate data by MONTH or DAY depending on period length
  const chartData = useMemo(() => {
    if (isShortPeriod) {
      // DAILY aggregation for short periods
      const allDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      
      // Map current data by day - using net_payout for Marge Uber (without meal vouchers)
      const currentByDay: Record<string, { sales: number; netPayout: number; mealVoucher: number; orders: number }> = {};
      currentPeriodData.forEach(row => {
        const dayKey = row.day; // format yyyy-MM-dd
        if (!currentByDay[dayKey]) {
          currentByDay[dayKey] = { sales: 0, netPayout: 0, mealVoucher: 0, orders: 0 };
        }
        currentByDay[dayKey].sales += Number(row.sales) || 0;
        currentByDay[dayKey].netPayout += Number(row.net_payout) || 0;
        currentByDay[dayKey].mealVoucher += Number(row.meal_voucher) || 0;
        currentByDay[dayKey].orders += Number(row.orders_count) || 0;
      });
      
      // Map previous data by day
      const prevByDay: Record<string, { sales: number; netPayout: number; mealVoucher: number; orders: number }> = {};
      previousPeriodData.forEach(row => {
        const dayKey = row.day;
        if (!prevByDay[dayKey]) {
          prevByDay[dayKey] = { sales: 0, netPayout: 0, mealVoucher: 0, orders: 0 };
        }
        prevByDay[dayKey].sales += Number(row.sales) || 0;
        prevByDay[dayKey].netPayout += Number(row.net_payout) || 0;
        prevByDay[dayKey].mealVoucher += Number(row.meal_voucher) || 0;
        prevByDay[dayKey].orders += Number(row.orders_count) || 0;
      });
      
      return allDays.map((day) => {
        const dayKey = format(day, "yyyy-MM-dd");
        const current = currentByDay[dayKey] || { sales: 0, netPayout: 0, mealVoucher: 0, orders: 0 };
        
        // Calculate previous day key based on comparison mode
        let prevDayKey: string;
        if (comparisonMode === "rollingPeriod") {
          const prevDay = subWeeks(day, 4);
          prevDayKey = format(prevDay, "yyyy-MM-dd");
        } else {
          const prevDay = subYears(day, 1);
          prevDayKey = format(prevDay, "yyyy-MM-dd");
        }
        const previous = prevByDay[prevDayKey] || { sales: 0, netPayout: 0, mealVoucher: 0, orders: 0 };
        
        // MARGE UBER = net_payout / sales (without meal vouchers)
        const profitability = current.sales > 0 ? (current.netPayout / current.sales) * 100 : null;
        const prevProfitability = previous.sales > 0 ? (previous.netPayout / previous.sales) * 100 : null;
        
        // TR bonus for tooltip
        const trBonus = current.sales > 0 ? (current.mealVoucher / current.sales) * 100 : 0;
        const prevTrBonus = previous.sales > 0 ? (previous.mealVoucher / previous.sales) * 100 : 0;
        
        return {
          date: dayKey,
          month: format(day, "yyyy-MM"),
          monthLabel: format(day, "dd/MM"), // Short label for X axis
          monthFull: format(day, "EEEE d MMMM yyyy", { locale: fr }),
          profitability,
          prevProfitability,
          sales: current.sales,
          netPayout: current.netPayout,
          mealVoucher: current.mealVoucher,
          orders: current.orders,
          prevSales: previous.sales,
          prevNetPayout: previous.netPayout,
          prevMealVoucher: previous.mealVoucher,
          prevOrders: previous.orders,
          trBonus,
          prevTrBonus,
        };
      });
    } else {
      // MONTHLY aggregation for longer periods
      const allMonths = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
      
      // Aggregate current period by month - using net_payout for Marge Uber
      const currentByMonth: Record<string, { sales: number; netPayout: number; mealVoucher: number; orders: number }> = {};
      currentPeriodData.forEach(row => {
        const monthKey = format(new Date(row.day), "yyyy-MM");
        if (!currentByMonth[monthKey]) {
          currentByMonth[monthKey] = { sales: 0, netPayout: 0, mealVoucher: 0, orders: 0 };
        }
        currentByMonth[monthKey].sales += Number(row.sales) || 0;
        currentByMonth[monthKey].netPayout += Number(row.net_payout) || 0;
        currentByMonth[monthKey].mealVoucher += Number(row.meal_voucher) || 0;
        currentByMonth[monthKey].orders += Number(row.orders_count) || 0;
      });
      
      // Aggregate previous period by month
      const prevByMonth: Record<string, { sales: number; netPayout: number; mealVoucher: number; orders: number }> = {};
      previousPeriodData.forEach(row => {
        const monthKey = format(new Date(row.day), "yyyy-MM");
        if (!prevByMonth[monthKey]) {
          prevByMonth[monthKey] = { sales: 0, netPayout: 0, mealVoucher: 0, orders: 0 };
        }
        prevByMonth[monthKey].sales += Number(row.sales) || 0;
        prevByMonth[monthKey].netPayout += Number(row.net_payout) || 0;
        prevByMonth[monthKey].mealVoucher += Number(row.meal_voucher) || 0;
        prevByMonth[monthKey].orders += Number(row.orders_count) || 0;
      });
      
      // Build aligned chart data by month
      return allMonths.map((month) => {
        const monthKey = format(month, "yyyy-MM");
        const current = currentByMonth[monthKey] || { sales: 0, netPayout: 0, mealVoucher: 0, orders: 0 };
        
        // Calculate previous month key based on comparison mode
        let prevMonthKey: string;
        if (comparisonMode === "rollingPeriod") {
          const prevMonth = subWeeks(month, 4);
          prevMonthKey = format(startOfMonth(prevMonth), "yyyy-MM");
        } else {
          const prevMonth = subYears(month, 1);
          prevMonthKey = format(prevMonth, "yyyy-MM");
        }
        const previous = prevByMonth[prevMonthKey] || { sales: 0, netPayout: 0, mealVoucher: 0, orders: 0 };
        
        // MARGE UBER = net_payout / sales (without meal vouchers)
        const profitability = current.sales > 0 ? (current.netPayout / current.sales) * 100 : null;
        const prevProfitability = previous.sales > 0 ? (previous.netPayout / previous.sales) * 100 : null;
        
        // TR bonus for tooltip
        const trBonus = current.sales > 0 ? (current.mealVoucher / current.sales) * 100 : 0;
        const prevTrBonus = previous.sales > 0 ? (previous.mealVoucher / previous.sales) * 100 : 0;
        
        return {
          date: undefined,
          month: monthKey,
          monthLabel: format(month, "MMM", { locale: fr }),
          monthFull: format(month, "MMMM yyyy", { locale: fr }),
          profitability,
          prevProfitability,
          sales: current.sales,
          netPayout: current.netPayout,
          mealVoucher: current.mealVoucher,
          orders: current.orders,
          prevSales: previous.sales,
          prevNetPayout: previous.netPayout,
          prevMealVoucher: previous.mealVoucher,
          prevOrders: previous.orders,
          trBonus,
          prevTrBonus,
        };
      });
    }
  }, [currentPeriodData, previousPeriodData, dateRange, comparisonMode, isShortPeriod]);

  // Handle chart click to navigate to Finances
  const handleChartClick = (data: any) => {
    if (!onMonthClick || !data?.activePayload?.[0]) return;
    
    const payload = data.activePayload[0].payload;
    
    if (isShortPeriod && payload.date) {
      // In daily view, extract month from the clicked day
      const clickedDate = new Date(payload.date);
      onMonthClick(clickedDate.getMonth() + 1);
    } else if (payload.month) {
      // In monthly view, extract month directly
      const monthNum = parseInt(payload.month.split("-")[1], 10);
      onMonthClick(monthNum);
    }
  };

  // Calculate totals and KPIs - using netPayout for Marge Uber
  const { totalProfitability, prevTotalProfitability, variation, totalSales, prevTotalSales, totalNetPayout, totalMealVoucher, totalOrders } = useMemo(() => {
    const totalSales = chartData.reduce((sum, d) => sum + (d.sales || 0), 0);
    const totalNetPayout = chartData.reduce((sum, d) => sum + (d.netPayout || 0), 0);
    const totalMealVoucher = chartData.reduce((sum, d) => sum + (d.mealVoucher || 0), 0);
    const totalOrders = chartData.reduce((sum, d) => sum + (d.orders || 0), 0);
    const prevTotalSales = chartData.reduce((sum, d) => sum + (d.prevSales || 0), 0);
    const prevTotalNetPayout = chartData.reduce((sum, d) => sum + (d.prevNetPayout || 0), 0);
    
    // Marge Uber = net_payout / sales (without meal vouchers)
    const totalProfitability = totalSales > 0 ? (totalNetPayout / totalSales) * 100 : 0;
    const prevTotalProfitability = prevTotalSales > 0 ? (prevTotalNetPayout / prevTotalSales) * 100 : 0;
    const variation = totalProfitability - prevTotalProfitability;
    
    // Debug log for Marge Uber calculation
    console.log("[ProfitabilityChart] Marge Uber Calculation:", {
      totalSales: totalSales.toFixed(2),
      totalNetPayout: totalNetPayout.toFixed(2),
      totalMealVoucher: totalMealVoucher.toFixed(2),
      margeUber: totalProfitability.toFixed(2) + "%",
      trBonus: totalSales > 0 ? ((totalMealVoucher / totalSales) * 100).toFixed(2) + "%" : "0%",
      rawDataPoints: currentPeriodData.length,
      chartDataPoints: chartData.length,
      dateRange: `${format(dateRange.start, "yyyy-MM-dd")} → ${format(dateRange.end, "yyyy-MM-dd")}`,
    });
    
    return { totalProfitability, prevTotalProfitability, variation, totalSales, prevTotalSales, totalNetPayout, totalMealVoucher, totalOrders };
  }, [chartData, currentPeriodData, dateRange]);

  // Period labels
  const selectedYear = format(dateRange.start, "yyyy");
  const prevYear = comparisonMode === "rollingPeriod" 
    ? "-4 sem." 
    : format(previousDateRange.start, "yyyy");

  // Check if we have previous data
  const hasPrevData = prevTotalSales > 0;

  // Dynamic Y-axis domain with zoom effect (like Panier Moyen)
  const profitabilityDomain = useMemo(() => {
    const values = chartData.flatMap(d => 
      [d.profitability, d.prevProfitability].filter((v): v is number => v !== null && v > 0)
    );
    if (values.length === 0) return [50, 70];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 5;
    
    // Ajouter une marge de 20% pour la lisibilité
    return [
      Math.floor(Math.max(0, min - range * 0.2)),
      Math.ceil(Math.min(100, max + range * 0.2))
    ];
  }, [chartData]);

  // Custom tooltip (like Panier Moyen style)
  const CustomTooltip = ({ active, payload }: any) => {
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
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
        <p className="font-semibold mb-2 capitalize">{data.monthFull}</p>
        
        <div className="space-y-1.5">
          {/* Current */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">{selectedYear}</span>
            </div>
            <span className="font-semibold text-emerald-600">
              {profitability !== null ? `${profitability.toFixed(1)}%` : "--"}
            </span>
          </div>
          
          {/* Previous */}
          {hasPrevData && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
                <span className="text-muted-foreground">{prevYear}</span>
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
        </div>
      </div>
    );
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = chartData.map(row => ({
      "Mois": row.monthFull,
      [`Rentabilité ${selectedYear}`]: row.profitability?.toFixed(1) || "--",
      ...(hasPrevData ? { 
        [`Rentabilité ${prevYear}`]: row.prevProfitability?.toFixed(1) || "--",
        "Variation (pp)": row.profitability !== null && row.prevProfitability !== null 
          ? (row.profitability - row.prevProfitability).toFixed(1) 
          : "--"
      } : {}),
      "Ventes": row.sales,
      "Marge Uber": row.netPayout,
      "TR": row.mealVoucher,
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
      {/* Header with KPIs (Panier Moyen style) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Icon + title + KPIs in single styled block */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-emerald-500" />
            <span className="font-semibold">Rentabilité globale</span>
          </div>
          
          {/* KPIs block (like Panier Moyen) */}
          <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/30 rounded-xl">
            <div className="flex items-center gap-2.5">
              <Percent className="h-5 w-5 text-emerald-500" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{selectedYear}</p>
                <p className="text-base font-bold">{totalProfitability.toFixed(1)}%</p>
              </div>
            </div>
            
            {hasPrevData && (
              <>
                <div className="h-10 w-px bg-border" />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{prevYear}</p>
                  <p className="text-sm text-muted-foreground">{prevTotalProfitability.toFixed(1)}%</p>
                </div>
                
                <div className="h-10 w-px bg-border" />
                <div className={cn(
                  "flex items-center gap-1 font-semibold text-base",
                  variation > 0 ? "text-emerald-500" : variation < 0 ? "text-red-500" : "text-muted-foreground"
                )}>
                  {variation > 0 ? <ArrowUp className="h-4 w-4" /> : 
                   variation < 0 ? <ArrowDown className="h-4 w-4" /> : 
                   <Minus className="h-4 w-4" />}
                  <span>{variation > 0 ? "+" : ""}{variation.toFixed(1)}pp</span>
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
      
      {/* Chart - Line only with smooth curves (like Panier Moyen) */}
      {viewMode === 'chart' && (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData}
              onClick={handleChartClick}
              style={{ cursor: onMonthClick ? "pointer" : "default" }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="monthLabel" 
                className="text-xs"
                tick={{ fontSize: 12 }}
                interval={isShortPeriod ? "preserveStartEnd" : 0}
              />
              <YAxis 
                domain={profitabilityDomain}
                className="text-xs"
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Previous period line (dashed, muted) */}
              {hasPrevData && (
                <Line 
                  type="monotone"
                  dataKey="prevProfitability" 
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeOpacity={0.6}
                  dot={{ r: 3, fill: "hsl(var(--muted-foreground))" }}
                  connectNulls
                />
              )}
              
              {/* Current period line (solid, bold) */}
              <Line 
                type="monotone"
                dataKey="profitability" 
                stroke="hsl(142 71% 45%)"
                strokeWidth={3}
                dot={{ r: 4, fill: "hsl(142 71% 45%)" }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Table */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">Rentabilité {selectedYear}</TableHead>
                {hasPrevData && (
                  <>
                    <TableHead className="text-right">Rentabilité {prevYear}</TableHead>
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
                  <TableCell className="font-medium capitalize">{row.monthFull}</TableCell>
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
                  <TableCell className="text-right">{row.netPayout.toLocaleString("fr-FR")} €</TableCell>
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
                  {chartData.reduce((sum, d) => sum + d.netPayout, 0).toLocaleString("fr-FR")} €
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
