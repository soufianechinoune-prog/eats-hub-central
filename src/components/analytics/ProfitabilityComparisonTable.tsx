import { useMemo, useState } from "react";
import { format, getWeek, getMonth, getYear, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayoutDetailSheet } from "./PayoutDetailSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertCircle,
  ArrowUpDown,
  HelpCircle,
  Calendar,
  LayoutList,
  Layers,
  Percent,
  Euro
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PayoutData {
  payout_date: string;
  restaurant_id: string;
  sales_incl_vat: number;
  sales_excl_vat?: number;
  net_payout: number;
  uber_fee_after_promo_incl_vat: number;
  uber_fee_after_promo_excl_vat?: number;
  uber_fee_before_promo_excl_vat?: number;
  uber_fee_promo_excl_vat?: number;
  vat_uber_fee?: number;
  item_promo_incl_vat: number;
  refund_incl_vat: number;
  refund_excl_vat?: number;
  other_payments_incl_vat: number;
  marketing_fee_adjustment: number;
  order_count: number;
  meal_voucher_amount?: number;
}

interface RestaurantData {
  id: string;
  name: string;
  uber_commission_rate?: number | null;
}

interface ProfitabilityComparisonTableProps {
  payouts: PayoutData[];
  restaurants: RestaurantData[];
}

// Helper to format percentage
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

// Helper to format currency
const formatCurrency = (value: number) => {
  const absValue = Math.abs(value);
  return `${value < 0 ? '-' : ''}${absValue.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
};

interface ComparisonRow {
  label: string;
  date: string;
  restaurantId: string;
  restaurantName: string;
  sales: number;
  netPayout: number;
  profitability: number;
  // Commission breakdown
  uberFeeGross: number;      // Commission brute (avant promo)
  uberFeeReduction: number;  // Réduction Uber
  uberFeeNet: number;        // Commission nette (après promo)
  uberFeeRate: number;       // Taux net en % (calculé sur base HT)
  uberFeeGrossRate: number;  // Taux brut en %
  contractRate: number | null; // Taux contractuel
  promoRate: number;
  refundRate: number;
  otherRate: number;
  // Amounts for toggling display
  promoAmount: number;
  refundAmount: number;
  orderCount: number;
  avgBasket: number;
  weekNumber: number;
  year: number;
  weekLabel: string;
}

type DisplayMode = 'percent' | 'amount';

interface WeekGroup {
  weekKey: string;
  weekLabel: string;
  weekNumber: number;
  year: number;
  restaurants: ComparisonRow[];
}

interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  monthNumber: number;
  year: number;
  rows: ComparisonRow[];
  totalSales: number;
  totalPayout: number;
  avgProfitability: number;
  avgUberFeeRate: number;
  avgPromoRate: number;
  avgRefundRate: number;
  totalUberFee: number;
  totalPromo: number;
  totalRefund: number;
  totalOrders: number;
}

type ViewMode = 'profitability' | 'week' | 'month';

export function ProfitabilityComparisonTable({ 
  payouts, 
  restaurants 
}: ProfitabilityComparisonTableProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPayouts, setSelectedPayouts] = useState<PayoutData[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('profitability');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('percent');
  
  const getRestaurantName = (id: string) => {
    return restaurants.find(r => r.id === id)?.name || id.slice(0, 8);
  };

  const getContractRate = (id: string) => {
    return restaurants.find(r => r.id === id)?.uber_commission_rate ?? null;
  };
  
  // Handle row click to open detail sheet
  const handleRowClick = (row: ComparisonRow) => {
    const matchingPayouts = payouts.filter(p => p.payout_date === row.date);
    setSelectedDate(row.date);
    setSelectedPayouts(matchingPayouts);
    setSheetOpen(true);
  };
  
  // Transform payouts into comparison rows
  const comparisonData = useMemo(() => {
    return payouts.map((payout): ComparisonRow => {
      const sales = Math.abs(Number(payout.sales_incl_vat) || 0);
      const netPayout = Number(payout.net_payout) || 0;
      const uberFeeNet = Math.abs(Number(payout.uber_fee_after_promo_incl_vat) || 0);
      const uberFeeGrossHT = Math.abs(Number(payout.uber_fee_before_promo_excl_vat) || 0);
      const uberFeeReductionHT = Math.abs(Number(payout.uber_fee_promo_excl_vat) || 0);
      const vatUberFee = Math.abs(Number(payout.vat_uber_fee) || 0);
      // Calculer brut TTC = brut HT + TVA proportionnelle
      const uberFeeGross = uberFeeGrossHT > 0 ? uberFeeGrossHT + (vatUberFee * (uberFeeGrossHT / (uberFeeGrossHT - uberFeeReductionHT || 1))) : uberFeeNet;
      const uberFeeReduction = uberFeeReductionHT > 0 ? uberFeeReductionHT * 1.2 : 0; // Approximation TVA 20%
      const promoAmount = Math.abs(Number(payout.item_promo_incl_vat) || 0);
      const refundAmount = Math.abs(Number(payout.refund_incl_vat) || 0);
      const other = Math.abs(Number(payout.other_payments_incl_vat) || 0);
      const orderCount = Number(payout.order_count) || 0;
      
      // Calcul du taux de commission HT : Frais Uber HT / (Ventes HT - Remboursements HT)
      const salesHT = Math.abs(Number(payout.sales_excl_vat) || 0);
      const uberFeeHT = Math.abs(Number(payout.uber_fee_after_promo_excl_vat) || 0);
      const refundHT = Number(payout.refund_excl_vat) || 0;
      const baseHT = salesHT + refundHT;
      const uberFeeRateHT = baseHT > 0 ? (uberFeeHT / baseHT) * 100 : 0;
      
      // Rentabilité = (Versement Uber + Titres restaurant) / CA TTC
      const mealVoucher = Math.abs(Number(payout.meal_voucher_amount) || 0);
      const totalToReceive = netPayout + mealVoucher;
      
      // Week calculation
      const payoutDate = new Date(payout.payout_date);
      const weekNum = getWeek(payoutDate, { weekStartsOn: 1 });
      const yearNum = getYear(payoutDate);
      const weekStart = startOfWeek(payoutDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(payoutDate, { weekStartsOn: 1 });
      const weekLabelStr = `Sem. ${weekNum} (${format(weekStart, "d", { locale: fr })}-${format(weekEnd, "d MMM", { locale: fr })})`;
      
      return {
        label: payout.payout_date,
        date: payout.payout_date,
        restaurantId: payout.restaurant_id,
        restaurantName: getRestaurantName(payout.restaurant_id),
        sales,
        netPayout,
        profitability: sales > 0 ? (totalToReceive / sales) * 100 : 0,
        uberFeeGross,
        uberFeeReduction,
        uberFeeNet,
        uberFeeRate: uberFeeRateHT,
        uberFeeGrossRate: sales > 0 ? (uberFeeGross / sales) * 100 : 0,
        contractRate: getContractRate(payout.restaurant_id),
        promoRate: sales > 0 ? (promoAmount / sales) * 100 : 0,
        refundRate: sales > 0 ? (refundAmount / sales) * 100 : 0,
        otherRate: sales > 0 ? (other / sales) * 100 : 0,
        promoAmount,
        refundAmount,
        orderCount,
        avgBasket: orderCount > 0 ? sales / orderCount : 0,
        weekNumber: weekNum,
        year: yearNum,
        weekLabel: weekLabelStr,
      };
    }).sort((a, b) => b.profitability - a.profitability);
  }, [payouts, restaurants]);
  
  // Group by week for week view mode
  const weekGroups = useMemo((): WeekGroup[] => {
    const groups: Record<string, WeekGroup> = {};
    
    comparisonData.forEach(row => {
      const key = `${row.year}-${row.weekNumber}`;
      if (!groups[key]) {
        groups[key] = {
          weekKey: key,
          weekLabel: row.weekLabel,
          weekNumber: row.weekNumber,
          year: row.year,
          restaurants: [],
        };
      }
      groups[key].restaurants.push(row);
    });
    
    // Sort groups by year desc then week desc, and restaurants by profitability
    return Object.values(groups)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.weekNumber - a.weekNumber;
      })
      .map(group => ({
        ...group,
        restaurants: group.restaurants.sort((a, b) => b.profitability - a.profitability),
      }));
  }, [comparisonData]);
  
  // Group by month for month view mode
  const monthGroups = useMemo((): MonthGroup[] => {
    const groups: Record<string, { rows: ComparisonRow[]; monthNumber: number; year: number }> = {};
    
    comparisonData.forEach(row => {
      const payoutDate = new Date(row.date);
      const monthNum = getMonth(payoutDate);
      const yearNum = getYear(payoutDate);
      const key = `${yearNum}-${monthNum}`;
      
      if (!groups[key]) {
        groups[key] = {
          rows: [],
          monthNumber: monthNum,
          year: yearNum,
        };
      }
      groups[key].rows.push(row);
    });
    
    return Object.entries(groups)
      .map(([key, { rows, monthNumber, year }]) => {
        const totalSales = rows.reduce((sum, r) => sum + r.sales, 0);
        const totalPayout = rows.reduce((sum, r) => sum + r.netPayout, 0);
        const totalUberFee = rows.reduce((sum, r) => sum + r.uberFeeNet, 0);
        const totalPromo = rows.reduce((sum, r) => sum + r.promoAmount, 0);
        const totalRefund = rows.reduce((sum, r) => sum + r.refundAmount, 0);
        const totalOrders = rows.reduce((sum, r) => sum + r.orderCount, 0);
        
        // Calculate rates based on total sales
        const avgUberFeeRate = totalSales > 0 ? (totalUberFee / totalSales) * 100 : 0;
        const avgPromoRate = totalSales > 0 ? (totalPromo / totalSales) * 100 : 0;
        const avgRefundRate = totalSales > 0 ? (totalRefund / totalSales) * 100 : 0;
        const avgProfitability = totalSales > 0 ? (totalPayout / totalSales) * 100 : 0;
        
        // Create month label
        const monthDate = new Date(year, monthNumber, 1);
        const monthLabel = format(monthDate, "MMMM yyyy", { locale: fr });
        
        return {
          monthKey: key,
          monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          monthNumber,
          year,
          rows: rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          totalSales,
          totalPayout,
          avgProfitability,
          avgUberFeeRate,
          avgPromoRate,
          avgRefundRate,
          totalUberFee,
          totalPromo,
          totalRefund,
          totalOrders,
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.monthNumber - a.monthNumber;
      });
  }, [comparisonData]);
  
  // Calculate averages for comparison
  const averages = useMemo(() => {
    if (comparisonData.length === 0) return null;
    
    const totalSales = comparisonData.reduce((sum, d) => sum + d.sales, 0);
    const totalNet = comparisonData.reduce((sum, d) => sum + d.netPayout, 0);
    const avgUberRate = comparisonData.reduce((sum, d) => sum + d.uberFeeRate, 0) / comparisonData.length;
    const avgPromoRate = comparisonData.reduce((sum, d) => sum + d.promoRate, 0) / comparisonData.length;
    const avgRefundRate = comparisonData.reduce((sum, d) => sum + d.refundRate, 0) / comparisonData.length;
    const avgOtherRate = comparisonData.reduce((sum, d) => sum + d.otherRate, 0) / comparisonData.length;
    const avgProfitability = totalSales > 0 ? (totalNet / totalSales) * 100 : 0;
    
    // Average amounts
    const avgUberFeeAmount = comparisonData.reduce((sum, d) => sum + d.uberFeeNet, 0) / comparisonData.length;
    const avgPromoAmount = comparisonData.reduce((sum, d) => sum + d.promoAmount, 0) / comparisonData.length;
    const avgRefundAmount = comparisonData.reduce((sum, d) => sum + d.refundAmount, 0) / comparisonData.length;
    
    return {
      profitability: avgProfitability,
      uberFeeRate: avgUberRate,
      promoRate: avgPromoRate,
      refundRate: avgRefundRate,
      otherRate: avgOtherRate,
      uberFeeAmount: avgUberFeeAmount,
      promoAmount: avgPromoAmount,
      refundAmount: avgRefundAmount,
    };
  }, [comparisonData]);
  
  if (comparisonData.length === 0) return null;
  
  // Check if we have multiple different restaurants or just one
  const uniqueRestaurants = new Set(comparisonData.map(d => d.restaurantId));
  const isSingleRestaurant = uniqueRestaurants.size === 1;
  
  // Find the best and worst performers
  const best = comparisonData[0];
  const worst = comparisonData[comparisonData.length - 1];
  const profitabilityGap = best.profitability - worst.profitability;
  
  // Simple cell component - displays percent or amount
  const ComparisonCell = ({ 
    percentValue, 
    amountValue,
    isCommission = false
  }: { 
    percentValue: number; 
    amountValue: number;
    isCommission?: boolean;
  }) => {
    if (displayMode === 'amount') {
      return (
        <span className="font-medium tabular-nums">
          {formatCurrency(amountValue)}
        </span>
      );
    }
    return (
      <span className="font-medium tabular-nums">
        {percentValue.toFixed(1)}%
      </span>
    );
  };
  
  // Check if we have multiple restaurants (needed for week view)
  const hasMultipleRestaurants = uniqueRestaurants.size > 1;
  
  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpDown className="h-4 w-4" />
            Comparatif de Rentabilité
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="text-xs">
                    Ce tableau compare les versements pour comprendre les écarts de rentabilité.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          
          <div className="flex gap-1">
            {/* Display mode toggle for Commission/Promos/Remb */}
            <Button
              variant={displayMode === 'percent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('percent')}
              className="h-7 text-xs gap-1.5"
            >
              <Percent className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={displayMode === 'amount' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('amount')}
              className="h-7 text-xs gap-1.5"
            >
              <Euro className="h-3.5 w-3.5" />
            </Button>
            
            {/* Separator */}
            <div className="w-px bg-border mx-1" />
            
            {/* View mode toggle - always show */}
            <Button
              variant={viewMode === 'profitability' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('profitability')}
              className="h-7 text-xs gap-1.5"
            >
              <LayoutList className="h-3.5 w-3.5" />
              Rentabilité
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="h-7 text-xs gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" />
              Semaine
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('month')}
              className="h-7 text-xs gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Mois
            </Button>
          </div>
        </div>
        
        {/* Gap indicator - only in profitability mode */}
        {viewMode === 'profitability' && profitabilityGap > 2 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{profitabilityGap.toFixed(1)} pts d'écart</span> entre 
              {isSingleRestaurant ? (
                <>
                  <span className="text-green-600"> {format(new Date(best.date), "d MMM", { locale: fr })}</span> ({best.profitability.toFixed(1)}%) et 
                  <span className="text-red-600"> {format(new Date(worst.date), "d MMM", { locale: fr })}</span> ({worst.profitability.toFixed(1)}%)
                </>
              ) : (
                <>
                  <span className="text-green-600"> {best.restaurantName}</span> ({best.profitability.toFixed(1)}%) et 
                  <span className="text-red-600"> {worst.restaurantName}</span> ({worst.profitability.toFixed(1)}%)
                </>
              )}
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">
                  {viewMode === 'week' ? 'Semaine / Restaurant' : (isSingleRestaurant ? "Versement" : "Restaurant")}
                </TableHead>
                <TableHead className="text-right">CA TTC</TableHead>
                <TableHead className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        Rentabilité
                        <HelpCircle className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Total à encaisser (Versement Uber + Titres restaurant) / CA TTC × 100</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right text-orange-600">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        Commission
                        <HelpCircle className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="text-xs space-y-1">
                          <p className="font-medium">Frais Uber après promotions (TTC)</p>
                          <p className="text-muted-foreground">
                            Cliquez sur une ligne pour voir la décomposition.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right">Promos</TableHead>
                <TableHead className="text-right">Remb.</TableHead>
                <TableHead className="text-right text-green-600">Versement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewMode === 'profitability' && (
                // Standard profitability view
                <>
                  {comparisonData.map((row, index) => (
                    <TableRow 
                      key={`${row.restaurantId}-${row.date}`}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        index === 0 && "bg-green-500/5 hover:bg-green-500/10",
                        index === comparisonData.length - 1 && comparisonData.length > 1 && "bg-red-500/5 hover:bg-red-500/10"
                      )}
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index === 0 && <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">TOP</Badge>}
                          {index === comparisonData.length - 1 && comparisonData.length > 1 && (
                            <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1">BAS</Badge>
                          )}
                          {isSingleRestaurant ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{format(new Date(row.date), "d MMMM yyyy", { locale: fr })}</span>
                            </div>
                          ) : (
                            <span className="font-medium">{row.restaurantName}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isSingleRestaurant ? row.restaurantName : null}
                          {isSingleRestaurant ? " • " : ""}{row.orderCount} cmd • Ø {formatCurrency(row.avgBasket)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(row.sales)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        <span className="font-medium tabular-nums">{row.profitability.toFixed(1)}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <ComparisonCell percentValue={row.uberFeeRate} amountValue={row.uberFeeNet} isCommission />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <ComparisonCell percentValue={row.promoRate} amountValue={row.promoAmount} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <ComparisonCell percentValue={row.refundRate} amountValue={row.refundAmount} />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600 tabular-nums">
                        {formatCurrency(row.netPayout)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Average row */}
                  {averages && comparisonData.length > 1 && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2} className="text-muted-foreground">
                        Moyenne
                      </TableCell>
                      <TableCell className="text-right text-green-600 tabular-nums">
                        {averages.profitability.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(averages.uberFeeAmount)
                          : `${averages.uberFeeRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(averages.promoAmount)
                          : `${averages.promoRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(averages.refundAmount)
                          : `${averages.refundRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </>
              )}
              
              {viewMode === 'week' && (
                // Week grouped view
                <>
                  {weekGroups.map((group) => {
                    const bestInGroup = group.restaurants[0];
                    const worstInGroup = group.restaurants[group.restaurants.length - 1];
                    const hasGap = group.restaurants.length > 1;
                    const profitGap = hasGap ? bestInGroup.profitability - worstInGroup.profitability : 0;
                    const salesGap = hasGap ? bestInGroup.sales - worstInGroup.sales : 0;
                    const payoutGap = hasGap ? bestInGroup.netPayout - worstInGroup.netPayout : 0;
                    
                    return (
                      <>
                        {/* Week header row */}
                        <TableRow key={group.weekKey} className="bg-muted/30 hover:bg-muted/40">
                          <TableCell colSpan={7} className="py-2">
                            <div className="flex items-center gap-2 font-medium">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {group.weekLabel}
                              {hasGap && profitGap > 1 && (
                                <Badge variant="outline" className="text-xs text-muted-foreground font-normal ml-2">
                                  Écart {profitGap.toFixed(1)} pts
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Restaurant rows within the week */}
                        {group.restaurants.map((row, idx) => (
                          <TableRow 
                            key={`${group.weekKey}-${row.restaurantId}-${row.date}`}
                            className={cn(
                              "cursor-pointer hover:bg-muted/50 transition-colors",
                              idx === 0 && hasGap && "bg-green-500/5 hover:bg-green-500/10",
                              idx === group.restaurants.length - 1 && hasGap && "bg-red-500/5 hover:bg-red-500/10"
                            )}
                            onClick={() => handleRowClick(row)}
                          >
                            <TableCell className="pl-8">
                              <div className="flex items-center gap-2">
                                {idx === 0 && hasGap && <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">+</Badge>}
                                {idx === group.restaurants.length - 1 && hasGap && <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1">−</Badge>}
                                <span className="font-medium">
                                  {isSingleRestaurant 
                                    ? format(new Date(row.date), "d MMMM", { locale: fr })
                                    : row.restaurantName
                                  }
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground pl-0">
                                {row.orderCount} cmd • Ø {formatCurrency(row.avgBasket)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(row.sales)}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              <span className="font-medium tabular-nums">{row.profitability.toFixed(1)}%</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <ComparisonCell percentValue={row.uberFeeRate} amountValue={row.uberFeeNet} isCommission />
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              <ComparisonCell percentValue={row.promoRate} amountValue={row.promoAmount} />
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              <ComparisonCell percentValue={row.refundRate} amountValue={row.refundAmount} />
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600 tabular-nums">
                              {formatCurrency(row.netPayout)}
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {/* Gap row for the week */}
                        {hasGap && (
                          <TableRow className="bg-muted/10 text-xs border-b-2">
                            <TableCell className="pl-8 py-1.5 italic text-muted-foreground">
                              Écart
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {salesGap >= 0 ? '+' : ''}{formatCurrency(salesGap)}
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums font-medium">
                              <span className={profitGap >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {profitGap >= 0 ? '+' : ''}{profitGap.toFixed(1)} pts
                              </span>
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount' 
                                ? `${(bestInGroup.uberFeeNet - worstInGroup.uberFeeNet) >= 0 ? '+' : ''}${formatCurrency(bestInGroup.uberFeeNet - worstInGroup.uberFeeNet)}`
                                : `${(bestInGroup.uberFeeRate - worstInGroup.uberFeeRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount' 
                                ? `${(bestInGroup.promoAmount - worstInGroup.promoAmount) >= 0 ? '+' : ''}${formatCurrency(bestInGroup.promoAmount - worstInGroup.promoAmount)}`
                                : `${(bestInGroup.promoRate - worstInGroup.promoRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {displayMode === 'amount' 
                                ? `${(bestInGroup.refundAmount - worstInGroup.refundAmount) >= 0 ? '+' : ''}${formatCurrency(bestInGroup.refundAmount - worstInGroup.refundAmount)}`
                                : `${(bestInGroup.refundRate - worstInGroup.refundRate).toFixed(1)} pts`
                              }
                            </TableCell>
                            <TableCell className="text-right py-1.5 tabular-nums text-muted-foreground">
                              {payoutGap >= 0 ? '+' : ''}{formatCurrency(payoutGap)}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </>
              )}
              
              {viewMode === 'month' && (
                // Month grouped view
                <>
                  {monthGroups.map((group, groupIndex) => (
                    <TableRow 
                      key={group.monthKey}
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        groupIndex === 0 && monthGroups.length > 1 && "bg-green-500/5 hover:bg-green-500/10",
                        groupIndex === monthGroups.length - 1 && monthGroups.length > 1 && "bg-red-500/5 hover:bg-red-500/10"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {groupIndex === 0 && monthGroups.length > 1 && (
                            <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">TOP</Badge>
                          )}
                          {groupIndex === monthGroups.length - 1 && monthGroups.length > 1 && (
                            <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1">BAS</Badge>
                          )}
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{group.monthLabel}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.rows.length} versement{group.rows.length > 1 ? 's' : ''} • {group.totalOrders} cmd • Ø {group.totalOrders > 0 ? formatCurrency(group.totalSales / group.totalOrders) : '0 €'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(group.totalSales)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        <span className="font-medium tabular-nums">{group.avgProfitability.toFixed(1)}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <ComparisonCell percentValue={group.avgUberFeeRate} amountValue={group.totalUberFee} isCommission />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <ComparisonCell percentValue={group.avgPromoRate} amountValue={group.totalPromo} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <ComparisonCell percentValue={group.avgRefundRate} amountValue={group.totalRefund} />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600 tabular-nums">
                        {formatCurrency(group.totalPayout)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Total row for months */}
                  {monthGroups.length > 1 && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2} className="text-muted-foreground">
                        Total
                      </TableCell>
                      <TableCell className="text-right text-green-600 tabular-nums">
                        {averages?.profitability.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalUberFee, 0))
                          : `${averages?.uberFeeRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalPromo, 0))
                          : `${averages?.promoRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {displayMode === 'amount' 
                          ? formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalRefund, 0))
                          : `${averages?.refundRate.toFixed(1)}%`
                        }
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600 tabular-nums">
                        {formatCurrency(monthGroups.reduce((sum, g) => sum + g.totalPayout, 0))}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      
      {/* Detail Sheet */}
      <PayoutDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedDate={selectedDate}
        payouts={selectedPayouts}
        restaurants={restaurants}
      />
    </Card>
  );
}
