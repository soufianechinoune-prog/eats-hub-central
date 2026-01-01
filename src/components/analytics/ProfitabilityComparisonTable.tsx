import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayoutDetailSheet } from "./PayoutDetailSheet";
import { Badge } from "@/components/ui/badge";
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
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PayoutData {
  payout_date: string;
  restaurant_id: string;
  sales_incl_vat: number;
  net_payout: number;
  uber_fee_after_promo_incl_vat: number;
  uber_fee_before_promo_excl_vat?: number;
  uber_fee_promo_excl_vat?: number;
  vat_uber_fee?: number;
  item_promo_incl_vat: number;
  refund_incl_vat: number;
  other_payments_incl_vat: number;
  marketing_fee_adjustment: number;
  order_count: number;
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
  uberFeeRate: number;       // Taux net en %
  uberFeeGrossRate: number;  // Taux brut en %
  contractRate: number | null; // Taux contractuel
  promoRate: number;
  refundRate: number;
  otherRate: number;
  orderCount: number;
  avgBasket: number;
}

export function ProfitabilityComparisonTable({ 
  payouts, 
  restaurants 
}: ProfitabilityComparisonTableProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPayouts, setSelectedPayouts] = useState<PayoutData[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  
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
      const promos = Math.abs(Number(payout.item_promo_incl_vat) || 0);
      const refunds = Math.abs(Number(payout.refund_incl_vat) || 0);
      const other = Math.abs(Number(payout.other_payments_incl_vat) || 0);
      const orderCount = Number(payout.order_count) || 0;
      
      return {
        label: payout.payout_date,
        date: payout.payout_date,
        restaurantId: payout.restaurant_id,
        restaurantName: getRestaurantName(payout.restaurant_id),
        sales,
        netPayout,
        profitability: sales > 0 ? (netPayout / sales) * 100 : 0,
        uberFeeGross,
        uberFeeReduction,
        uberFeeNet,
        uberFeeRate: sales > 0 ? (uberFeeNet / sales) * 100 : 0,
        uberFeeGrossRate: sales > 0 ? (uberFeeGross / sales) * 100 : 0,
        contractRate: getContractRate(payout.restaurant_id),
        promoRate: sales > 0 ? (promos / sales) * 100 : 0,
        refundRate: sales > 0 ? (refunds / sales) * 100 : 0,
        otherRate: sales > 0 ? (other / sales) * 100 : 0,
        orderCount,
        avgBasket: orderCount > 0 ? sales / orderCount : 0,
      };
    }).sort((a, b) => b.profitability - a.profitability);
  }, [payouts, restaurants]);
  
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
    
    return {
      profitability: avgProfitability,
      uberFeeRate: avgUberRate,
      promoRate: avgPromoRate,
      refundRate: avgRefundRate,
      otherRate: avgOtherRate,
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
  
  // Cell component with comparison indicator
  const ComparisonCell = ({ 
    value, 
    average, 
    inverse = false,
    suffix = '%'
  }: { 
    value: number; 
    average: number; 
    inverse?: boolean;
    suffix?: string;
  }) => {
    const diff = value - average;
    const isGood = inverse ? diff < -0.5 : diff > 0.5;
    const isBad = inverse ? diff > 0.5 : diff < -0.5;
    
    return (
      <div className="w-full flex justify-end">
        <div className="flex items-center gap-1">
          <span className={cn(
            "font-medium tabular-nums",
            isGood && "text-green-600",
            isBad && "text-red-600"
          )}>
            {value.toFixed(1)}{suffix}
          </span>
          {Math.abs(diff) > 0.5 && (
            <span className={cn(
              "text-xs",
              isGood ? "text-green-600" : "text-red-600"
            )}>
              {isGood ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            </span>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
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
                  Les indicateurs verts/rouges montrent les performances par rapport à la moyenne.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        
        {/* Gap indicator */}
        {profitabilityGap > 2 && (
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
                <TableHead className="min-w-[200px]">{isSingleRestaurant ? "Versement" : "Restaurant"}</TableHead>
                <TableHead className="text-right">CA TTC</TableHead>
                <TableHead className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        Rentabilité
                        <HelpCircle className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Versement Net / CA TTC × 100</p>
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
                            Comprend les frais de service Uber Eats après déduction des réductions de commission accordées par Uber.
                          </p>
                          <p className="text-muted-foreground mt-1">
                            Cliquez sur une ligne pour voir la décomposition : commission brute → réductions → commission nette.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right text-pink-600">Promos</TableHead>
                <TableHead className="text-right text-red-600">Remb.</TableHead>
                <TableHead className="text-right">Versement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                  <TableCell className="text-right">
                    {averages && (
                      <ComparisonCell 
                        value={row.profitability} 
                        average={averages.profitability} 
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            {averages && (
                              <ComparisonCell 
                                value={row.uberFeeRate} 
                                average={averages.uberFeeRate} 
                                inverse 
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <div className="text-xs space-y-2">
                            <p className="font-medium text-foreground">Décomposition Commission</p>
                            <div className="space-y-1.5 text-muted-foreground">
                              <div className="flex justify-between gap-4">
                                <span>Commission brute</span>
                                <span className="font-medium text-foreground tabular-nums">
                                  {formatCurrency(row.uberFeeGross)} ({row.uberFeeGrossRate.toFixed(1)}%)
                                </span>
                              </div>
                              {row.uberFeeReduction > 0 && (
                                <div className="flex justify-between gap-4 text-green-600">
                                  <span>Réduction Uber</span>
                                  <span className="font-medium tabular-nums">
                                    -{formatCurrency(row.uberFeeReduction)}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between gap-4 border-t border-border pt-1">
                                <span className="font-medium text-foreground">Commission nette</span>
                                <span className="font-medium text-orange-600 tabular-nums">
                                  {formatCurrency(row.uberFeeNet)} ({row.uberFeeRate.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            {row.contractRate !== null && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Taux contractuel</span>
                                  <span className="font-medium tabular-nums">{row.contractRate}%</span>
                                </div>
                                <div className="flex justify-between gap-4 mt-1">
                                  <span className="text-muted-foreground">Taux réel observé</span>
                                  <span className={cn(
                                    "font-medium tabular-nums",
                                    row.uberFeeRate < row.contractRate ? "text-green-600" : 
                                    row.uberFeeRate > row.contractRate + 1 ? "text-red-600" : "text-foreground"
                                  )}>
                                    {row.uberFeeRate.toFixed(1)}%
                                  </span>
                                </div>
                                {row.uberFeeRate < row.contractRate && (
                                  <p className="text-green-600 mt-1 text-[10px]">
                                    ✓ {(row.contractRate - row.uberFeeRate).toFixed(1)} pts sous le contrat
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right">
                    {averages && (
                      <ComparisonCell 
                        value={row.promoRate} 
                        average={averages.promoRate} 
                        inverse 
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {averages && (
                      <ComparisonCell 
                        value={row.refundRate} 
                        average={averages.refundRate} 
                        inverse 
                      />
                    )}
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
                  <TableCell className="text-right tabular-nums">
                    {averages.profitability.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-orange-600 tabular-nums">
                    {averages.uberFeeRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-pink-600 tabular-nums">
                    {averages.promoRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-red-600 tabular-nums">
                    {averages.refundRate.toFixed(1)}%
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Legend */}
        <div className="px-4 py-3 border-t border-border bg-muted/20">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span>Meilleur que la moyenne</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-600" />
              <span>En dessous de la moyenne</span>
            </div>
          </div>
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
