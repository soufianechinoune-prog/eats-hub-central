import { useMemo, useState } from "react";
import { format, eachMonthOfInterval, eachDayOfInterval, startOfMonth, subYears, subWeeks, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Percent, LayoutList, ChartArea,
  ArrowUp, ArrowDown, Minus, Download, ArrowLeftRight, Flag, HelpCircle, BarChart3, Coins
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import * as XLSX from "xlsx";
import { useAnalyticsContext, type ProfitabilityBase } from "@/contexts/AnalyticsContext";
import { useRestaurantActions, ACTION_CATEGORY_COLORS, type RestaurantAction } from "@/hooks/useRestaurantActions";

// Daily order data from useFinancesDrilldown (same source as "Par Jour" table)
interface DailyOrderData {
  date: string;               // "2025-12-01"
  label: string;              // "Lun 01 déc"
  sales_incl_vat: number;     // CA TTC
  net_payout: number;         // Versement Uber
  meal_voucher_amount: number; // Titres resto
  promo_incl_vat: number;     // Promos
  order_count: number;        // Nombre de commandes
  uber_fee_incl_vat: number;  // Frais Uber
  refund_incl_vat: number;    // Remboursements
  avg_basket: number;         // Panier moyen
  total_payout: number;       // Versement total
}

interface ProfitabilityComparisonChartProps {
  dailyOrdersData: DailyOrderData[];
  dateRange: { start: Date; end: Date };
  previousDateRange: { start: Date; end: Date };
  isLoading?: boolean;
  comparisonMode?: "yearOverYear" | "rollingPeriod";
  onComparisonModeChange?: (mode: "yearOverYear" | "rollingPeriod") => void;
  onMonthClick?: (monthNum: number) => void;
  restaurantIds?: string[];
  platform?: string;
  // Action props from parent (FinancesSection)
  showActions?: boolean;
  selectedActionIds?: Set<string>;
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

// Action marker label for chart
function ActionMarkerLabel({ viewBox, actions, color }: { viewBox?: { x?: number; y?: number }; actions: RestaurantAction[]; color: string }) {
  if (!viewBox || viewBox.x === undefined) return null;
  const count = actions.length;
  return (
    <g>
      <circle cx={viewBox.x} cy={10} r={8} fill={color} />
      <text x={viewBox.x} y={14} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold">
        {count}
      </text>
    </g>
  );
}

export const ProfitabilityComparisonChart = ({
  dailyOrdersData,
  dateRange,
  previousDateRange,
  isLoading,
  comparisonMode = "yearOverYear",
  onComparisonModeChange,
  onMonthClick,
  restaurantIds,
  platform,
  showActions = false,
  selectedActionIds,
}: ProfitabilityComparisonChartProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  
  // Get profitability base from context
  const { profitabilityBase, setProfitabilityBase } = useAnalyticsContext();
  
  // Fetch actions for the chart
  const year = dateRange.start.getFullYear();
  const { data: actions = [] } = useRestaurantActions(
    year,
    restaurantIds,
    platform || "uber_eats"
  );

  // Detect if short period (≤ 45 days → show daily instead of monthly)
  const isShortPeriod = useMemo(() => {
    return differenceInDays(dateRange.end, dateRange.start) <= 45;
  }, [dateRange]);
  
  // Group actions by date key (day or month), filtered by selectedActionIds
  const actionsByDateKey = useMemo(() => {
    const grouped: Record<string, RestaurantAction[]> = {};
    actions.forEach(action => {
      // Filter by selectedActionIds if provided
      if (selectedActionIds && selectedActionIds.size > 0 && !selectedActionIds.has(action.id)) {
        return;
      }
      const dateKey = isShortPeriod 
        ? action.start_date.substring(0, 10)  // yyyy-MM-dd
        : action.start_date.substring(0, 7);   // yyyy-MM
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(action);
    });
    return grouped;
  }, [actions, isShortPeriod, selectedActionIds]);

  // Use daily orders data directly (same source as "Par Jour" table)
  const chartData = useMemo(() => {
    // Helper to calculate profitability based on base type
    const calcProfitability = (netPayout: number, mealVoucher: number, sales: number, promo: number): number | null => {
      const totalPayout = netPayout + mealVoucher;
      const denominator = profitabilityBase === 'net' 
        ? Math.max(0, sales - promo) 
        : sales;
      return denominator > 0 ? (totalPayout / denominator) * 100 : null;
    };

    if (isShortPeriod) {
      // DAILY view - use dailyOrdersData directly (already aggregated by day)
      return dailyOrdersData.map((day) => {
        const profitability = calcProfitability(
          day.net_payout, 
          day.meal_voucher_amount, 
          day.sales_incl_vat, 
          day.promo_incl_vat
        );
        const trBonus = day.sales_incl_vat > 0 ? (day.meal_voucher_amount / day.sales_incl_vat) * 100 : 0;
        
        return {
          date: day.date,
          month: day.date.substring(0, 7),
          monthLabel: format(new Date(day.date), "dd/MM"),
          monthFull: format(new Date(day.date), "EEEE d MMMM yyyy", { locale: fr }),
          profitability,
          prevProfitability: null,
          sales: day.sales_incl_vat,
          netPayout: day.net_payout,
          mealVoucher: day.meal_voucher_amount,
          orders: day.order_count,
          promo: day.promo_incl_vat,
          prevSales: 0,
          prevNetPayout: 0,
          prevMealVoucher: 0,
          prevOrders: 0,
          trBonus,
          prevTrBonus: 0,
        };
      });
    } else {
      // MONTHLY aggregation from daily data
      const allMonths = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
      
      // Aggregate daily data by month
      const dataByMonth: Record<string, {
        sales: number;
        netPayout: number;
        mealVoucher: number;
        promo: number;
        orders: number;
      }> = {};

      dailyOrdersData.forEach((day) => {
        const monthKey = day.date.substring(0, 7); // yyyy-MM
        if (!dataByMonth[monthKey]) {
          dataByMonth[monthKey] = { sales: 0, netPayout: 0, mealVoucher: 0, promo: 0, orders: 0 };
        }
        dataByMonth[monthKey].sales += day.sales_incl_vat;
        dataByMonth[monthKey].netPayout += day.net_payout;
        dataByMonth[monthKey].mealVoucher += day.meal_voucher_amount;
        dataByMonth[monthKey].promo += day.promo_incl_vat;
        dataByMonth[monthKey].orders += day.order_count;
      });

      return allMonths.map((month) => {
        const monthKey = format(month, "yyyy-MM");
        const data = dataByMonth[monthKey] || { sales: 0, netPayout: 0, mealVoucher: 0, promo: 0, orders: 0 };
        
        const profitability = calcProfitability(data.netPayout, data.mealVoucher, data.sales, data.promo);
        const trBonus = data.sales > 0 ? (data.mealVoucher / data.sales) * 100 : 0;
        
        return {
          date: undefined,
          month: monthKey,
          monthLabel: format(month, "MMM", { locale: fr }),
          monthFull: format(month, "MMMM yyyy", { locale: fr }),
          profitability,
          prevProfitability: null,
          sales: data.sales,
          netPayout: data.netPayout,
          mealVoucher: data.mealVoucher,
          orders: data.orders,
          promo: data.promo,
          prevSales: 0,
          prevNetPayout: 0,
          prevMealVoucher: 0,
          prevOrders: 0,
          trBonus,
          prevTrBonus: 0,
        };
      });
    }
  }, [dailyOrdersData, dateRange, isShortPeriod, profitabilityBase]);

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

  // Calculate totals and KPIs from chartData (already aggregated from payouts)
  const { totalProfitability, prevTotalProfitability, variation, totalSales, prevTotalSales, totalNetPayout, totalMealVoucher, totalOrders, totalPromo } = useMemo(() => {
    const totalSales = chartData.reduce((sum, d) => sum + (d.sales || 0), 0);
    const totalNetPayout = chartData.reduce((sum, d) => sum + (d.netPayout || 0), 0);
    const totalMealVoucher = chartData.reduce((sum, d) => sum + (d.mealVoucher || 0), 0);
    const totalOrders = chartData.reduce((sum, d) => sum + (d.orders || 0), 0);
    const totalPromo = chartData.reduce((sum, d) => sum + (d.promo || 0), 0);
    
    // Total payout includes meal vouchers
    const totalPayoutWithVoucher = totalNetPayout + totalMealVoucher;
    
    // Calculate denominator based on profitability base
    const denominator = profitabilityBase === 'net' 
      ? Math.max(0, totalSales - totalPromo) 
      : totalSales;
    
    const totalProfitability = denominator > 0 ? (totalPayoutWithVoucher / denominator) * 100 : 0;
    
    // No previous data comparison (same source = same values)
    const prevTotalSales = 0;
    const prevTotalProfitability = 0;
    const variation = 0;
    
    console.log("[ProfitabilityChart] Unified data (from payouts):", {
      base: profitabilityBase,
      totalSales: totalSales.toFixed(2),
      totalPromo: totalPromo.toFixed(2),
      denominator: denominator.toFixed(2),
      totalNetPayout: totalNetPayout.toFixed(2),
      totalMealVoucher: totalMealVoucher.toFixed(2),
      profitability: totalProfitability.toFixed(2) + "%",
      chartDataPoints: chartData.length,
      dateRange: `${format(dateRange.start, "yyyy-MM-dd")} → ${format(dateRange.end, "yyyy-MM-dd")}`,
    });
    
    return { totalProfitability, prevTotalProfitability, variation, totalSales, prevTotalSales, totalNetPayout, totalMealVoucher, totalOrders, totalPromo };
  }, [chartData, dateRange, profitabilityBase]);

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
          {/* Profitability base toggle (Brut/Net) */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={cn(
                      "h-7 px-2 transition-all",
                      profitabilityBase === 'gross' 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setProfitabilityBase('gross')}
                  >
                    <span className="text-xs">Brut</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">Base Brut</p>
                  <p className="text-xs text-muted-foreground">Rentabilité sur Ventes TTC (inclut promos)</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={cn(
                      "h-7 px-2 transition-all",
                      profitabilityBase === 'net' 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setProfitabilityBase('net')}
                  >
                    <span className="text-xs">Net</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">Base Net</p>
                  <p className="text-xs text-muted-foreground">Rentabilité sur Ventes - Promos (encaissé)</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
          
          {/* Info icon with HoverCard (short) + Popover (detailed) */}
          <Popover>
            <HoverCard openDelay={200}>
              <PopoverTrigger asChild>
                <HoverCardTrigger asChild>
                  <button 
                    className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                    aria-label="Comment sont calculées les marges ?"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </HoverCardTrigger>
              </PopoverTrigger>
              
              {/* Short version on hover */}
              <HoverCardContent side="bottom" className="w-[280px] p-3 text-sm">
                <p className="font-medium mb-1">Deux marges complémentaires :</p>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• <span className="font-medium text-foreground">Brut</span> = alignée rapports Uber (contrôle)</li>
                  <li>• <span className="font-medium text-foreground">Net</span> = vraie rentabilité (pilotage)</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2 italic">Cliquez ℹ️ pour plus de détails</p>
              </HoverCardContent>
            </HoverCard>
            
            {/* Detailed version on click */}
            <PopoverContent side="bottom" align="end" className="w-[580px] p-0">
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-base">Comment sont calculées vos marges ?</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sur Uber Eats, il existe deux façons complémentaires de lire la rentabilité.
                  </p>
                </div>
                
                {/* Two columns for Brut and Net */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Marge Uber (Brut) */}
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-blue-500/10">
                        <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <span className="font-medium text-sm">Marge Uber (Brut)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Calculée sur le <span className="font-medium text-foreground">CA affiché</span>, avant déduction des promotions.
                    </p>
                    <div className="bg-background/50 rounded p-2 border-l-2 border-blue-500">
                      <p className="text-xs italic text-foreground/90">
                        👉 "Sur 100€ affichés, combien me reverse Uber ?"
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Utile pour :</p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        <li>Suivre l'impact des promotions</li>
                        <li>Auditer les commissions Uber</li>
                        <li>Comparer avec les rapports Uber</li>
                      </ul>
                    </div>
                  </div>
                  
                  {/* Marge économique (Net) */}
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-emerald-500/10">
                        <Coins className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <span className="font-medium text-sm">Marge économique (Net)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Calculée sur les <span className="font-medium text-foreground">ventes payées</span> par les clients, après promotions.
                    </p>
                    <div className="bg-background/50 rounded p-2 border-l-2 border-emerald-500">
                      <p className="text-xs italic text-foreground/90">
                        👉 "Sur 100€ payés, combien j'encaisse ?"
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Utile pour :</p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        <li>Mesurer la vraie rentabilité</li>
                        <li>Piloter les promotions</li>
                        <li>Prendre de meilleures décisions</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Concrete example - compact */}
                <div className="rounded-lg bg-muted/50 border p-2.5 flex gap-4 items-start">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground mb-1">📝 Exemple concret</p>
                    <p className="text-xs text-muted-foreground">
                      Client voit <span className="font-medium text-foreground">100€</span>, paie <span className="font-medium text-foreground">80€</span> (promo 20%). Les 20€ sont <span className="italic">offerts par vous</span>.
                    </p>
                  </div>
                  <div className="bg-background/70 rounded px-2 py-1.5 text-[11px] space-y-0.5 shrink-0">
                    <p>• <span className="font-medium">Brut</span> = 100€ (CA déclaré)</p>
                    <p>• <span className="font-medium">Net</span> = 80€ (CA effectif)</p>
                  </div>
                </div>
                
                {/* Why two margins + Summary - inline */}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5">
                    <p className="text-xs font-medium text-foreground mb-1">🎯 Pourquoi deux marges ?</p>
                    <p className="text-[11px] text-muted-foreground">
                      Les promotions sont un <span className="italic">coût marketing</span>, pas un vrai CA.
                    </p>
                  </div>
                  <div className="flex-1 rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                    <p className="text-xs font-medium text-foreground/90 mb-1">💡 Complémentaires</p>
                    <p className="text-[11px] text-muted-foreground">
                      Brut pour contrôler Uber, Net pour décider.
                    </p>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
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
              margin={{ top: showActions ? 24 : 5, right: 5, left: 5, bottom: 5 }}
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
              
              {/* Action markers as ReferenceLine */}
              {showActions && chartData.map((dataPoint) => {
                const dateKey = dataPoint.date || dataPoint.month;
                const dayActions = actionsByDateKey[dateKey];
                if (!dayActions || dayActions.length === 0) return null;
                
                const primaryAction = dayActions[0];
                const color = ACTION_CATEGORY_COLORS[primaryAction.category] || "#64748b";
                
                return (
                  <ReferenceLine
                    key={`action-${dateKey}`}
                    x={dataPoint.monthLabel}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={<ActionMarkerLabel actions={dayActions} color={color} />}
                  />
                );
              })}
              
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
