import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown, 
  Euro, 
  Percent, 
  AlertCircle,
  ArrowRight,
  Minus,
  CreditCard,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
interface PayoutData {
  payout_date: string;
  restaurant_id: string;
  restaurant_name?: string;
  sales_incl_vat: number;
  net_payout: number;
  uber_fee_after_promo_incl_vat: number;
  item_promo_incl_vat: number;
  refund_incl_vat: number;
  other_payments_incl_vat: number;
  marketing_fee_adjustment: number;
  order_count: number;
  delivery_cost_incl_vat?: number;
  bag_fee?: number;
  packaging_fee?: number;
  tips?: number;
  meal_voucher_amount?: number;
}

interface PayoutDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string | null;
  payouts: PayoutData[];
  restaurants?: { id: string; name: string }[];
}

// Helper function to format currency
const formatCurrency = (value: number) => {
  const absValue = Math.abs(value);
  return `${value < 0 ? '-' : ''}${absValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};

// Helper to calculate profitability
const calcProfitability = (netPayout: number, sales: number) => {
  if (sales === 0) return 0;
  return (netPayout / sales) * 100;
};

// Component to show a single line item with impact
function LineItem({ 
  label, 
  value, 
  isNegative = false,
  highlight = false,
  percentage
}: { 
  label: string; 
  value: number; 
  isNegative?: boolean;
  highlight?: boolean;
  percentage?: number;
}) {
  const displayValue = isNegative ? -Math.abs(value) : value;
  return (
    <div className={cn(
      "flex items-center justify-between py-2 px-3 rounded-lg transition-colors",
      highlight && "bg-muted/50"
    )}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {percentage !== undefined && (
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            percentage > 0 ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"
          )}>
            {percentage.toFixed(1)}% du CA
          </span>
        )}
        <span className={cn(
          "font-medium",
          displayValue < 0 ? "text-red-600" : displayValue > 0 ? "text-green-600" : "text-muted-foreground"
        )}>
          {formatCurrency(displayValue)}
        </span>
      </div>
    </div>
  );
}

// Waterfall section showing the path from CA to Net
function WaterfallBreakdown({ payout }: { payout: PayoutData }) {
  const sales = Math.abs(Number(payout.sales_incl_vat) || 0);
  const uberFee = Math.abs(Number(payout.uber_fee_after_promo_incl_vat) || 0);
  const promos = Math.abs(Number(payout.item_promo_incl_vat) || 0);
  const refunds = Math.abs(Number(payout.refund_incl_vat) || 0);
  const otherPayments = Math.abs(Number(payout.other_payments_incl_vat) || 0);
  const marketingAdj = Number(payout.marketing_fee_adjustment) || 0;
  const mealVoucher = Math.abs(Number(payout.meal_voucher_amount) || 0);
  const netPayout = Number(payout.net_payout) || 0;
  
  // Calculate total deductions (excluding meal vouchers which are paid separately)
  const totalDeductions = uberFee + promos + refunds + otherPayments + Math.abs(marketingAdj) + mealVoucher;
  const profitability = calcProfitability(netPayout, sales);
  
  // Total the restaurant will actually receive (Uber payout + meal vouchers)
  const totalToReceive = netPayout + mealVoucher;
  const totalReceiveRate = sales > 0 ? (totalToReceive / sales) * 100 : 0;
  
  return (
    <div className="space-y-1">
      {/* CA TTC */}
      <div className="flex items-center justify-between py-3 px-3 bg-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-primary" />
          <span className="font-medium">CA TTC (Ventes)</span>
        </div>
        <span className="font-bold text-lg">{formatCurrency(sales)}</span>
      </div>
      
      {/* Deductions */}
      <div className="pl-4 border-l-2 border-red-200 dark:border-red-900 ml-4 space-y-0.5">
        <LineItem 
          label="Commission Uber Eats" 
          value={uberFee} 
          isNegative 
          percentage={(uberFee / sales) * 100}
        />
        {promos > 0 && (
          <LineItem 
            label="Promotions" 
            value={promos} 
            isNegative 
            percentage={(promos / sales) * 100}
          />
        )}
        {refunds > 0 && (
          <LineItem 
            label="Remboursements" 
            value={refunds} 
            isNegative 
            percentage={(refunds / sales) * 100}
            highlight
          />
        )}
        {otherPayments > 0 && (
          <LineItem 
            label="Autres ajustements" 
            value={otherPayments} 
            isNegative 
            percentage={(otherPayments / sales) * 100}
          />
        )}
        {marketingAdj !== 0 && (
          <LineItem 
            label="Ajustement marketing" 
            value={Math.abs(marketingAdj)} 
            isNegative={marketingAdj < 0}
          />
        )}
        {mealVoucher > 0 && (
          <div className={cn(
            "flex items-center justify-between py-2 px-3 rounded-lg transition-colors bg-blue-500/5"
          )}>
            <div className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Titres restaurant</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Ce montant sera versé directement par l'organisme de titres restaurant (Edenred, Swile, etc.), séparément du virement Uber.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                {((mealVoucher / sales) * 100).toFixed(1)}% du CA
              </span>
              <span className="font-medium text-red-600">
                {formatCurrency(-mealVoucher)}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Total Deductions Summary */}
      <div className="flex items-center justify-between py-2 px-3 bg-red-500/5 rounded-lg mt-2">
        <span className="text-sm font-medium text-red-600">Total des frais</span>
        <span className="font-semibold text-red-600">-{formatCurrency(totalDeductions)}</span>
      </div>
      
      {/* Net Payout */}
      <div className="flex items-center justify-between py-3 px-3 bg-green-500/10 rounded-lg border border-green-500/30 mt-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span className="font-medium">Versement Uber</span>
        </div>
        <div className="text-right">
          <span className="font-bold text-lg text-green-600">{formatCurrency(netPayout)}</span>
          <span className={cn(
            "text-xs ml-2 px-2 py-0.5 rounded-full",
            profitability >= 50 ? "bg-green-500/20 text-green-700" : 
            profitability >= 40 ? "bg-yellow-500/20 text-yellow-700" : 
            "bg-red-500/20 text-red-700"
          )}>
            {profitability.toFixed(1)}% du CA
          </span>
        </div>
      </div>
      
      {/* Total to receive including meal vouchers */}
      {mealVoucher > 0 && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Total à encaisser</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-blue-600">{formatCurrency(totalToReceive)}</span>
              <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700">
                {totalReceiveRate.toFixed(1)}% du CA
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            = Versement Uber ({formatCurrency(netPayout)}) + Titres restaurant ({formatCurrency(mealVoucher)})
          </p>
        </div>
      )}
    </div>
  );
}

// Component for a single restaurant payout card
function PayoutCard({ 
  payout, 
  restaurantName,
  comparisonProfitability
}: { 
  payout: PayoutData; 
  restaurantName: string;
  comparisonProfitability?: number;
}) {
  const sales = Math.abs(Number(payout.sales_incl_vat) || 0);
  const netPayout = Number(payout.net_payout) || 0;
  const profitability = calcProfitability(netPayout, sales);
  const orderCount = Number(payout.order_count) || 0;
  const avgBasket = orderCount > 0 ? sales / orderCount : 0;
  
  const diffVsComparison = comparisonProfitability !== undefined 
    ? profitability - comparisonProfitability 
    : null;
  
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted/30 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-base">{restaurantName}</h4>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline" className="text-xs">
                {orderCount} commandes
              </Badge>
              <span className="text-xs text-muted-foreground">
                Panier moyen: {formatCurrency(avgBasket)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className={cn(
              "text-2xl font-bold",
              profitability >= 50 ? "text-green-600" : 
              profitability >= 40 ? "text-yellow-600" : 
              "text-red-600"
            )}>
              {profitability.toFixed(1)}%
            </div>
            {diffVsComparison !== null && Math.abs(diffVsComparison) > 0.1 && (
              <div className={cn(
                "text-xs flex items-center justify-end gap-1",
                diffVsComparison > 0 ? "text-green-600" : "text-red-600"
              )}>
                {diffVsComparison > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {diffVsComparison > 0 ? '+' : ''}{diffVsComparison.toFixed(1)}% vs moyenne
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Breakdown */}
      <div className="p-4">
        <WaterfallBreakdown payout={payout} />
      </div>
    </div>
  );
}

export function PayoutDetailSheet({
  open,
  onOpenChange,
  selectedDate,
  payouts,
  restaurants = []
}: PayoutDetailSheetProps) {
  if (!selectedDate || payouts.length === 0) return null;
  
  const formattedDate = format(new Date(selectedDate), "EEEE d MMMM yyyy", { locale: fr });
  
  // Calculate totals and averages
  const totalSales = payouts.reduce((sum, p) => sum + Math.abs(Number(p.sales_incl_vat) || 0), 0);
  const totalNet = payouts.reduce((sum, p) => sum + (Number(p.net_payout) || 0), 0);
  const avgProfitability = totalSales > 0 ? (totalNet / totalSales) * 100 : 0;
  
  // Sort payouts by profitability for comparison
  const sortedPayouts = [...payouts].sort((a, b) => {
    const profA = calcProfitability(Number(a.net_payout) || 0, Math.abs(Number(a.sales_incl_vat) || 0));
    const profB = calcProfitability(Number(b.net_payout) || 0, Math.abs(Number(b.sales_incl_vat) || 0));
    return profB - profA;
  });
  
  // Get restaurant name helper
  const getRestaurantName = (id: string) => {
    return restaurants.find(r => r.id === id)?.name || id.slice(0, 8) + '...';
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Détail du versement
          </SheetTitle>
          <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
        </SheetHeader>
        
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">CA Total</p>
            <p className="font-semibold">{formatCurrency(totalSales)}</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Versement Net</p>
            <p className="font-semibold text-green-600">{formatCurrency(totalNet)}</p>
          </div>
          <div className={cn(
            "rounded-lg p-3 text-center",
            avgProfitability >= 50 ? "bg-green-500/10" : 
            avgProfitability >= 40 ? "bg-yellow-500/10" : 
            "bg-red-500/10"
          )}>
            <p className="text-xs text-muted-foreground mb-1">Rentabilité Moy.</p>
            <p className={cn(
              "font-semibold",
              avgProfitability >= 50 ? "text-green-600" : 
              avgProfitability >= 40 ? "text-yellow-600" : 
              "text-red-600"
            )}>
              {avgProfitability.toFixed(1)}%
            </p>
          </div>
        </div>
        
        <Separator className="mb-6" />
        
        {/* Restaurant breakdown */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            Détail par restaurant
            {sortedPayouts.length > 1 && (
              <span className="text-xs text-muted-foreground">
                (trié par rentabilité)
              </span>
            )}
          </h3>
          
          {sortedPayouts.map((payout, index) => (
            <PayoutCard
              key={`${payout.restaurant_id}-${index}`}
              payout={payout}
              restaurantName={getRestaurantName(payout.restaurant_id)}
              comparisonProfitability={avgProfitability}
            />
          ))}
        </div>
        
        {/* Insight section if multiple restaurants */}
        {sortedPayouts.length > 1 && (
          <>
            <Separator className="my-6" />
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                Analyse comparative
              </h4>
              {(() => {
                const best = sortedPayouts[0];
                const worst = sortedPayouts[sortedPayouts.length - 1];
                const bestProf = calcProfitability(Number(best.net_payout) || 0, Math.abs(Number(best.sales_incl_vat) || 0));
                const worstProf = calcProfitability(Number(worst.net_payout) || 0, Math.abs(Number(worst.sales_incl_vat) || 0));
                const diff = bestProf - worstProf;
                
                const bestUberRate = (Math.abs(Number(best.uber_fee_after_promo_incl_vat) || 0) / Math.abs(Number(best.sales_incl_vat) || 1)) * 100;
                const worstUberRate = (Math.abs(Number(worst.uber_fee_after_promo_incl_vat) || 0) / Math.abs(Number(worst.sales_incl_vat) || 1)) * 100;
                
                const bestRefundRate = (Math.abs(Number(best.refund_incl_vat) || 0) / Math.abs(Number(best.sales_incl_vat) || 1)) * 100;
                const worstRefundRate = (Math.abs(Number(worst.refund_incl_vat) || 0) / Math.abs(Number(worst.sales_incl_vat) || 1)) * 100;
                
                return (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Écart de rentabilité: <span className="font-semibold text-foreground">{diff.toFixed(1)} pts</span> entre{' '}
                      <span className="text-green-600">{getRestaurantName(best.restaurant_id)}</span> et{' '}
                      <span className="text-red-600">{getRestaurantName(worst.restaurant_id)}</span>
                    </p>
                    
                    {Math.abs(bestUberRate - worstUberRate) > 1 && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        Commission: {worstUberRate.toFixed(1)}% vs {bestUberRate.toFixed(1)}%
                      </p>
                    )}
                    
                    {Math.abs(bestRefundRate - worstRefundRate) > 0.5 && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        Remboursements: {worstRefundRate.toFixed(1)}% vs {bestRefundRate.toFixed(1)}%
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
