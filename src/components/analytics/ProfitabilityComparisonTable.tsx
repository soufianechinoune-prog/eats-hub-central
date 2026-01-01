import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PayoutData {
  payout_date: string;
  restaurant_id: string;
  sales_incl_vat: number;
  net_payout: number;
  uber_fee_after_promo_incl_vat: number;
  item_promo_incl_vat: number;
  refund_incl_vat: number;
  other_payments_incl_vat: number;
  marketing_fee_adjustment: number;
  order_count: number;
}

interface ProfitabilityComparisonTableProps {
  payouts: PayoutData[];
  restaurants: { id: string; name: string }[];
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
  uberFeeRate: number;
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
  
  const getRestaurantName = (id: string) => {
    return restaurants.find(r => r.id === id)?.name || id.slice(0, 8);
  };
  
  // Transform payouts into comparison rows
  const comparisonData = useMemo(() => {
    return payouts.map((payout): ComparisonRow => {
      const sales = Math.abs(Number(payout.sales_incl_vat) || 0);
      const netPayout = Number(payout.net_payout) || 0;
      const uberFee = Math.abs(Number(payout.uber_fee_after_promo_incl_vat) || 0);
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
        uberFeeRate: sales > 0 ? (uberFee / sales) * 100 : 0,
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
      <div className="flex items-center gap-1">
        <span className={cn(
          "font-medium",
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
              <span className="text-green-600"> {best.restaurantName}</span> ({best.profitability.toFixed(1)}%) et 
              <span className="text-red-600"> {worst.restaurantName}</span> ({worst.profitability.toFixed(1)}%)
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Restaurant</TableHead>
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
                <TableHead className="text-right text-orange-600">Commission</TableHead>
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
                    index === 0 && "bg-green-500/5",
                    index === comparisonData.length - 1 && comparisonData.length > 1 && "bg-red-500/5"
                  )}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {index === 0 && <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">TOP</Badge>}
                      {index === comparisonData.length - 1 && comparisonData.length > 1 && (
                        <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1">BAS</Badge>
                      )}
                      <span className="font-medium">{row.restaurantName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.orderCount} cmd • Ø {formatCurrency(row.avgBasket)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
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
                    {averages && (
                      <ComparisonCell 
                        value={row.uberFeeRate} 
                        average={averages.uberFeeRate} 
                        inverse 
                      />
                    )}
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
                  <TableCell className="text-right font-semibold text-green-600">
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
                  <TableCell className="text-right">
                    {averages.profitability.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-orange-600">
                    {averages.uberFeeRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-pink-600">
                    {averages.promoRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-red-600">
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
    </Card>
  );
}
