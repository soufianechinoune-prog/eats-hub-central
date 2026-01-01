import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown, 
  Euro, 
  AlertCircle,
  ArrowRight,
  CreditCard,
  Info,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PayoutData {
  payout_date: string;
  restaurant_id: string;
  restaurant_name?: string;
  // TTC values
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
  // HT values for detailed breakdown
  sales_excl_vat?: number;
  uber_fee_after_promo_excl_vat?: number;
  vat_uber_fee?: number;
  item_promo_excl_vat?: number;
  refund_excl_vat?: number;
  vat_refund?: number;
  delivery_promo_excl_vat?: number;
  price_adjustment_incl_vat?: number;
  price_adjustment_excl_vat?: number;
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

// Helper to calculate profitability (including meal vouchers)
const calcProfitability = (netPayout: number, mealVoucher: number, sales: number) => {
  if (sales === 0) return 0;
  const totalToReceive = netPayout + mealVoucher;
  return (totalToReceive / sales) * 100;
};

// Detailed breakdown item with HT + TVA sub-lines
function DetailedBreakdownItem({
  label,
  totalTTC,
  amountHT,
  vatAmount,
  sales,
  salesHT,
  isExpanded,
  onToggle,
  icon,
  iconColor = "text-muted-foreground",
  showCommissionRate = false
}: {
  label: string;
  totalTTC: number;
  amountHT: number;
  vatAmount: number;
  sales: number;
  salesHT?: number;
  isExpanded: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  iconColor?: string;
  showCommissionRate?: boolean;
}) {
  const percentage = sales > 0 ? (Math.abs(totalTTC) / sales) * 100 : 0;
  const hasDetail = amountHT !== 0 || vatAmount !== 0;
  
  // Calculate commission rate HT for display next to Montant HT
  const commissionRateHT = showCommissionRate && salesHT && salesHT > 0 
    ? (Math.abs(amountHT) / salesHT) * 100 
    : 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "flex items-center justify-between py-2 px-3 rounded-lg transition-colors cursor-pointer hover:bg-muted/50",
          isExpanded && "bg-muted/30"
        )}>
          <div className="flex items-center gap-2">
            {hasDetail && (
              isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
            {icon && <span className={iconColor}>{icon}</span>}
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">
              {percentage.toFixed(1)}% du CA
            </span>
            <span className="font-medium text-red-600">
              {formatCurrency(-Math.abs(totalTTC))}
            </span>
          </div>
        </div>
      </CollapsibleTrigger>
      {hasDetail && (
        <CollapsibleContent>
          <div className="ml-8 pl-3 border-l-2 border-muted space-y-1 py-1">
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-muted-foreground">
                Montant HT {showCommissionRate && commissionRateHT > 0 && (
                  <span className="text-amber-600 font-medium">({commissionRateHT.toFixed(2)}%)</span>
                )}
              </span>
              <span className="text-red-600">{formatCurrency(-Math.abs(amountHT))}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-muted-foreground">TVA (20%)</span>
              <span className="text-red-600">{formatCurrency(-Math.abs(vatAmount))}</span>
            </div>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// Simple line item for items without HT/TVA breakdown
function SimpleLineItem({ 
  label, 
  value, 
  isNegative = false,
  highlight = false,
  percentage,
  icon,
  iconColor = "text-muted-foreground",
  tooltip
}: { 
  label: string; 
  value: number; 
  isNegative?: boolean;
  highlight?: boolean;
  percentage?: number;
  icon?: React.ReactNode;
  iconColor?: string;
  tooltip?: string;
}) {
  const displayValue = isNegative ? -Math.abs(value) : value;
  
  const content = (
    <div className={cn(
      "flex items-center justify-between py-2 px-3 rounded-lg transition-colors",
      highlight && "bg-muted/50"
    )}>
      <div className="flex items-center gap-2">
        {icon && <span className={iconColor}>{icon}</span>}
        <span className="text-sm text-muted-foreground">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-3">
        {percentage !== undefined && percentage > 0 && (
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            displayValue < 0 ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"
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

  return content;
}

// Waterfall section showing the path from CA to Net
function WaterfallBreakdown({ payout, detailedView }: { payout: PayoutData; detailedView: boolean }) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // TTC values
  const sales = Math.abs(Number(payout.sales_incl_vat) || 0);
  const uberFeeTTC = Math.abs(Number(payout.uber_fee_after_promo_incl_vat) || 0);
  const promosTTC = Math.abs(Number(payout.item_promo_incl_vat) || 0);
  const refundsTTC = Math.abs(Number(payout.refund_incl_vat) || 0);
  const otherPayments = Math.abs(Number(payout.other_payments_incl_vat) || 0);
  const marketingAdj = Number(payout.marketing_fee_adjustment) || 0;
  const mealVoucher = Math.abs(Number(payout.meal_voucher_amount) || 0);
  const priceAdjTTC = Math.abs(Number(payout.price_adjustment_incl_vat) || 0);
  const netPayout = Number(payout.net_payout) || 0;

  // HT values for detailed breakdown
  const salesHT = Math.abs(Number(payout.sales_excl_vat) || 0);
  const uberFeeHT = Math.abs(Number(payout.uber_fee_after_promo_excl_vat) || 0);
  const vatUberFee = Math.abs(Number(payout.vat_uber_fee) || 0);
  const promosHT = Math.abs(Number(payout.item_promo_excl_vat) || 0);
  const refundsHT = Math.abs(Number(payout.refund_excl_vat) || 0);
  const vatRefund = Math.abs(Number(payout.vat_refund) || 0);
  const priceAdjHT = Math.abs(Number(payout.price_adjustment_excl_vat) || 0);

  // Calculate VAT for promos (inferred if not available)
  const vatPromos = promosTTC - promosHT;
  const vatPriceAdj = priceAdjTTC - priceAdjHT;

  // Calculate commission rate using HT formula
  const baseHT = salesHT + refundsHT; // refundsHT is already positive (absolute value)
  const commissionRateHT = baseHT > 0 ? (uberFeeHT / baseHT) * 100 : 0;
  
  // Calculate total deductions
  const totalDeductions = uberFeeTTC + promosTTC + refundsTTC + otherPayments + Math.abs(marketingAdj) + mealVoucher + priceAdjTTC;
  const profitability = calcProfitability(netPayout, mealVoucher, sales);
  
  // Net payout rate (Uber payout only, without meal vouchers)
  const netPayoutRate = sales > 0 ? (netPayout / sales) * 100 : 0;
  
  // Total to receive including meal vouchers
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
        <div className="text-right">
          <span className="font-bold text-lg">{formatCurrency(sales)}</span>
          {detailedView && salesHT > 0 && (
            <p className="text-xs text-muted-foreground">HT: {formatCurrency(salesHT)}</p>
          )}
        </div>
      </div>
      
      {/* Deductions */}
      <div className="pl-4 border-l-2 border-red-200 dark:border-red-900 ml-4 space-y-0.5">
        {/* Commission Uber - avec détail HT/TVA */}
        {detailedView && uberFeeHT > 0 ? (
          <DetailedBreakdownItem
            label="Frais de service Marketplace"
            totalTTC={uberFeeTTC}
            amountHT={uberFeeHT}
            vatAmount={vatUberFee}
            sales={sales}
            salesHT={baseHT}
            isExpanded={expandedItems['uber'] ?? true}
            onToggle={() => toggleItem('uber')}
            showCommissionRate={true}
          />
        ) : (
          <SimpleLineItem 
            label="Commission Uber Eats" 
            value={uberFeeTTC} 
            isNegative 
            percentage={(uberFeeTTC / sales) * 100}
          />
        )}

        {/* Promotions articles - avec détail HT/TVA */}
        {promosTTC > 0 && (
          detailedView && promosHT > 0 ? (
            <DetailedBreakdownItem
              label="Promotions articles"
              totalTTC={promosTTC}
              amountHT={promosHT}
              vatAmount={vatPromos}
              sales={sales}
              isExpanded={expandedItems['promos'] ?? false}
              onToggle={() => toggleItem('promos')}
            />
          ) : (
            <SimpleLineItem 
              label="Promotions" 
              value={promosTTC} 
              isNegative 
              percentage={(promosTTC / sales) * 100}
            />
          )
        )}

        {/* Remboursements - avec détail HT/TVA */}
        {refundsTTC > 0 && (
          detailedView && refundsHT > 0 ? (
            <DetailedBreakdownItem
              label="Remboursements"
              totalTTC={refundsTTC}
              amountHT={refundsHT}
              vatAmount={vatRefund}
              sales={sales}
              isExpanded={expandedItems['refunds'] ?? false}
              onToggle={() => toggleItem('refunds')}
            />
          ) : (
            <SimpleLineItem 
              label="Remboursements" 
              value={refundsTTC} 
              isNegative 
              percentage={(refundsTTC / sales) * 100}
              highlight
            />
          )
        )}

        {/* Ajustements prix */}
        {priceAdjTTC > 0 && (
          detailedView && priceAdjHT > 0 ? (
            <DetailedBreakdownItem
              label="Ajustements erreurs commande"
              totalTTC={priceAdjTTC}
              amountHT={priceAdjHT}
              vatAmount={vatPriceAdj}
              sales={sales}
              isExpanded={expandedItems['priceAdj'] ?? false}
              onToggle={() => toggleItem('priceAdj')}
            />
          ) : priceAdjTTC > 0 && (
            <SimpleLineItem 
              label="Ajustements erreurs" 
              value={priceAdjTTC} 
              isNegative 
              percentage={(priceAdjTTC / sales) * 100}
            />
          )
        )}

        {/* Autres ajustements - simple (pas de HT/TVA) */}
        {otherPayments > 0 && (
          <SimpleLineItem 
            label="Autres ajustements" 
            value={otherPayments} 
            isNegative 
            percentage={(otherPayments / sales) * 100}
          />
        )}

        {/* Marketing adjustment - simple */}
        {marketingAdj !== 0 && (
          <SimpleLineItem 
            label="Ajustement marketing" 
            value={Math.abs(marketingAdj)} 
            isNegative={marketingAdj < 0}
          />
        )}

        {/* Titres restaurant - special display */}
        {mealVoucher > 0 && (
          <SimpleLineItem 
            label="Titres restaurant" 
            value={mealVoucher} 
            isNegative
            percentage={(mealVoucher / sales) * 100}
            icon={<CreditCard className="h-3.5 w-3.5" />}
            iconColor="text-blue-500"
            tooltip="Ce montant sera versé directement par l'organisme de titres restaurant (Edenred, Swile, etc.), séparément du virement Uber."
          />
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
            netPayoutRate >= 50 ? "bg-green-500/20 text-green-700" : 
            netPayoutRate >= 40 ? "bg-yellow-500/20 text-yellow-700" : 
            "bg-red-500/20 text-red-700"
          )}>
            {netPayoutRate.toFixed(1)}% du CA
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
  comparisonProfitability,
  detailedView
}: { 
  payout: PayoutData; 
  restaurantName: string;
  comparisonProfitability?: number;
  detailedView: boolean;
}) {
  const sales = Math.abs(Number(payout.sales_incl_vat) || 0);
  const netPayout = Number(payout.net_payout) || 0;
  const mealVoucher = Math.abs(Number(payout.meal_voucher_amount) || 0);
  const profitability = calcProfitability(netPayout, mealVoucher, sales);
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
        <WaterfallBreakdown payout={payout} detailedView={detailedView} />
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
  const [detailedView, setDetailedView] = useState(true);

  if (!selectedDate || payouts.length === 0) return null;
  
  const formattedDate = format(new Date(selectedDate), "EEEE d MMMM yyyy", { locale: fr });
  
  // Calculate totals and averages
  const totalSales = payouts.reduce((sum, p) => sum + Math.abs(Number(p.sales_incl_vat) || 0), 0);
  const totalNet = payouts.reduce((sum, p) => sum + (Number(p.net_payout) || 0), 0);
  const avgProfitability = totalSales > 0 ? (totalNet / totalSales) * 100 : 0;
  
  // Sort payouts by profitability for comparison
  const sortedPayouts = [...payouts].sort((a, b) => {
    const profA = calcProfitability(Number(a.net_payout) || 0, Math.abs(Number(a.meal_voucher_amount) || 0), Math.abs(Number(a.sales_incl_vat) || 0));
    const profB = calcProfitability(Number(b.net_payout) || 0, Math.abs(Number(b.meal_voucher_amount) || 0), Math.abs(Number(b.sales_incl_vat) || 0));
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
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Détail du versement
            </SheetTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailedView(!detailedView)}
              className="gap-2"
            >
              {detailedView ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Vue simple
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Vue détaillée
                </>
              )}
            </Button>
          </div>
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

        {detailedView && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-medium mb-1">💡 Vue détaillée activée</p>
            <p>Cliquez sur chaque ligne de frais pour voir le détail HT + TVA comme sur votre facture Uber Eats.</p>
          </div>
        )}
        
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
              detailedView={detailedView}
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
                const bestProf = calcProfitability(Number(best.net_payout) || 0, Math.abs(Number(best.meal_voucher_amount) || 0), Math.abs(Number(best.sales_incl_vat) || 0));
                const worstProf = calcProfitability(Number(worst.net_payout) || 0, Math.abs(Number(worst.meal_voucher_amount) || 0), Math.abs(Number(worst.sales_incl_vat) || 0));
                const diff = bestProf - worstProf;
                
                // Use HT values for commission rate comparison if available
                const bestSalesHT = Math.abs(Number(best.sales_excl_vat) || 0);
                const worstSalesHT = Math.abs(Number(worst.sales_excl_vat) || 0);
                const bestRefundHT = Math.abs(Number(best.refund_excl_vat) || 0);
                const worstRefundHT = Math.abs(Number(worst.refund_excl_vat) || 0);
                const bestUberHT = Math.abs(Number(best.uber_fee_after_promo_excl_vat) || 0);
                const worstUberHT = Math.abs(Number(worst.uber_fee_after_promo_excl_vat) || 0);
                
                const bestBaseHT = bestSalesHT + bestRefundHT;
                const worstBaseHT = worstSalesHT + worstRefundHT;
                
                const bestUberRate = bestBaseHT > 0 ? (bestUberHT / bestBaseHT) * 100 : 
                  (Math.abs(Number(best.uber_fee_after_promo_incl_vat) || 0) / Math.abs(Number(best.sales_incl_vat) || 1)) * 100;
                const worstUberRate = worstBaseHT > 0 ? (worstUberHT / worstBaseHT) * 100 :
                  (Math.abs(Number(worst.uber_fee_after_promo_incl_vat) || 0) / Math.abs(Number(worst.sales_incl_vat) || 1)) * 100;
                
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
                        Commission{detailedView ? ' (HT)' : ''}: {worstUberRate.toFixed(1)}% vs {bestUberRate.toFixed(1)}%
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