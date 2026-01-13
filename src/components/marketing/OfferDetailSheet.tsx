import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown, 
  Euro, 
  CreditCard,
  Info,
  ShoppingBag,
  Users,
  Calendar,
  Percent,
  Target,
  PiggyBank,
  Calculator,
  Gift,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OfferProfitability } from "@/hooks/useOfferProfitability";
import { useOfferMatchedOrders, MatchedOrder } from "@/hooks/useOfferMatchedOrders";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface OfferDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: OfferProfitability | null;
}

// Helper function to format currency
const formatCurrency = (value: number) => {
  const absValue = Math.abs(value);
  return `${value < 0 ? '-' : ''}${absValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};

// Simple line item for displaying financial breakdown
function FinancialLineItem({ 
  label, 
  value, 
  isNegative = false,
  highlight = false,
  percentage,
  icon,
  iconColor = "text-muted-foreground",
  tooltip,
  bold = false
}: { 
  label: string; 
  value: number; 
  isNegative?: boolean;
  highlight?: boolean;
  percentage?: number;
  icon?: React.ReactNode;
  iconColor?: string;
  tooltip?: string;
  bold?: boolean;
}) {
  const displayValue = isNegative ? -Math.abs(value) : value;
  
  return (
    <div className={cn(
      "flex items-center justify-between py-2 px-3 rounded-lg transition-colors",
      highlight && "bg-muted/50"
    )}>
      <div className="flex items-center gap-2">
        {icon && <span className={iconColor}>{icon}</span>}
        <span className={cn("text-sm", bold ? "font-medium" : "text-muted-foreground")}>{label}</span>
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
          bold ? "font-bold" : "font-medium",
          displayValue < 0 ? "text-red-600" : displayValue > 0 ? "text-green-600" : "text-muted-foreground"
        )}>
          {formatCurrency(displayValue)}
        </span>
      </div>
    </div>
  );
}

// KPI card component
function KPICard({ 
  label, 
  value, 
  icon, 
  className 
}: { 
  label: string; 
  value: string | number; 
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-3 rounded-lg border bg-card text-center", className)}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// Get offer type badge style
function getOfferTypeBadge(offerType: string) {
  const type = offerType.toLowerCase();
  
  if (type.includes("bogo") || type.includes("1+1") || type.includes("offert")) {
    return <Badge className="bg-purple-500/20 text-purple-700 border-purple-500/30">Un acheté = un offert</Badge>;
  }
  if (type.includes("%") || type.includes("réduction")) {
    return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">{offerType}</Badge>;
  }
  if (type.includes("livraison")) {
    return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Livraison offerte</Badge>;
  }
  return <Badge variant="secondary">{offerType}</Badge>;
}

// Match type badge
function getMatchTypeBadge(matchType: "product" | "promo" | "period" | "none") {
  const config = {
    product: { label: "Matchées par produit", icon: CheckCircle, className: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" },
    promo: { label: "Commandes avec promo", icon: Gift, className: "bg-purple-500/20 text-purple-700 border-purple-500/30" },
    period: { label: "Période seule", icon: Calendar, className: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
    none: { label: "Pas de données", icon: XCircle, className: "bg-red-500/20 text-red-700 border-red-500/30" },
  };
  const { label, icon: Icon, className } = config[matchType];
  
  return (
    <Badge className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

// Profitability badge
function getProfitabilityBadge(level: OfferProfitability["profitability_level"], percentage?: number) {
  const config = {
    excellent: { label: "Excellent", icon: CheckCircle, className: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" },
    good: { label: "Rentable", icon: TrendingUp, className: "bg-green-500/20 text-green-700 border-green-500/30" },
    neutral: { label: "Neutre", icon: Target, className: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
    poor: { label: "Faible", icon: TrendingDown, className: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
    negative: { label: "Déficitaire", icon: XCircle, className: "bg-red-500/20 text-red-700 border-red-500/30" },
  };
  const { label, icon: Icon, className } = config[level];
  
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", className)}>
      <Icon className="h-5 w-5" />
      <div>
        <p className="font-semibold">{label}</p>
        {percentage !== undefined && <p className="text-xs">{percentage.toFixed(1)}% de rentabilité</p>}
      </div>
    </div>
  );
}

// Single order row component
function OrderRow({ order, isFirst }: { order: MatchedOrder; isFirst: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const orderDate = order.order_datetime ? parseISO(order.order_datetime) : null;
  
  const offerProductItems = order.items.filter(i => i.is_offer_product);
  const otherItems = order.items.filter(i => !i.is_offer_product);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors",
          !isFirst && "border-t"
        )}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 text-xs text-muted-foreground w-16">
              {orderDate && format(orderDate, "d MMM HH:mm", { locale: fr })}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {offerProductItems.length > 0 && (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 text-xs">
                    {offerProductItems.map(i => `${i.item_title} x${i.quantity}`).join(", ").slice(0, 30)}
                    {offerProductItems.map(i => `${i.item_title} x${i.quantity}`).join(", ").length > 30 && "..."}
                  </Badge>
                )}
                {order.promo_applied < 0 && (
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 text-xs">
                    Promo: {formatCurrency(order.promo_applied)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {order.items.length} article{order.items.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
              <p className="font-medium text-sm">{formatCurrency(order.sales_incl_vat)}</p>
              <p className="text-xs text-green-600">{formatCurrency(order.net_payout)}</p>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 pl-[76px] space-y-2">
          {/* Offer products first */}
          {offerProductItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm bg-emerald-500/5 rounded px-2 py-1">
              <div className="flex items-center gap-2">
                <Package className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-700">{item.item_title}</span>
                <span className="text-xs text-muted-foreground">x{item.quantity}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.item_promo_incl_vat < 0 && (
                  <span className="text-xs text-purple-600">{formatCurrency(item.item_promo_incl_vat)}</span>
                )}
                <span className="font-medium">{formatCurrency(item.sales_incl_vat)}</span>
              </div>
            </div>
          ))}
          {/* Other items */}
          {otherItems.slice(0, 5).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm text-muted-foreground px-2 py-1">
              <div className="flex items-center gap-2">
                <span>{item.item_title}</span>
                <span className="text-xs">x{item.quantity}</span>
              </div>
              <span>{formatCurrency(item.sales_incl_vat)}</span>
            </div>
          ))}
          {otherItems.length > 5 && (
            <p className="text-xs text-muted-foreground px-2">+ {otherItems.length - 5} autres articles</p>
          )}
          {/* Order summary */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 mt-2">
            <span>Commission: {formatCurrency(-Math.abs(order.commission))}</span>
            {order.refund < 0 && <span>Remb.: {formatCurrency(order.refund)}</span>}
            <span className="font-medium text-foreground">Net: {formatCurrency(order.net_payout)}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function OfferDetailSheet({ open, onOpenChange, offer }: OfferDetailSheetProps) {
  const { data: matchedData, isLoading: isLoadingOrders } = useOfferMatchedOrders(offer);
  
  if (!offer) return null;

  const hasMatchedData = matchedData && matchedData.match_type !== "none" && matchedData.matched_orders_count > 0;
  const hasRealData = hasMatchedData || offer.has_real_data;
  
  // Use matched data if available, otherwise fall back to offer data
  const sales = hasMatchedData ? matchedData.matched_sales : (offer.has_real_data ? (offer.real_sales || 0) : offer.generated_sales);
  const orders = hasMatchedData ? matchedData.matched_orders_count : (offer.has_real_data ? (offer.real_orders_count || offer.orders) : offer.orders);
  const avgBasket = orders > 0 ? sales / orders : 0;
  
  // Financial breakdown
  const commission = hasMatchedData ? matchedData.matched_commission : (offer.has_real_data ? (offer.real_commission || 0) : offer.commission);
  const promos = hasMatchedData ? matchedData.matched_promos : (offer.has_real_data ? (offer.real_promos || 0) : 0);
  const refunds = hasMatchedData ? matchedData.matched_refunds : (offer.has_real_data ? (offer.real_refunds || 0) : 0);
  const payout = hasMatchedData ? matchedData.matched_payout : (offer.has_real_data ? (offer.real_payout || 0) : (offer.generated_sales - offer.commission));
  const mealVoucher = offer.has_real_data ? (offer.real_meal_voucher || 0) : 0;
  const totalPayout = payout + mealVoucher;
  const profitability = sales > 0 ? (totalPayout / sales) * 100 : 0;
  
  // Calculate total deductions
  const totalDeductions = commission + promos + refunds + mealVoucher;
  
  // Period
  const startDate = offer.start_date ? parseISO(offer.start_date) : null;
  const endDate = offer.end_date ? parseISO(offer.end_date) : null;
  const durationDays = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <SheetTitle className="text-xl">
                {offer.product || offer.title || "Offre"}
              </SheetTitle>
              <div className="flex flex-wrap gap-2">
                {getOfferTypeBadge(offer.offer_type)}
                {matchedData && getMatchTypeBadge(matchedData.match_type)}
              </div>
            </div>
          </div>
          
          {/* Restaurant and Period */}
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span>{offer.restaurant_names?.join(", ") || "—"}</span>
            </div>
            {(startDate || endDate) && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {startDate && format(startDate, "d MMM", { locale: fr })}
                  {startDate && endDate && " → "}
                  {endDate && format(endDate, "d MMM yyyy", { locale: fr })}
                  {durationDays && ` (${durationDays} jours)`}
                </span>
              </div>
            )}
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        {/* Quick KPIs */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <KPICard 
            label="CA" 
            value={`${(sales / 1000).toFixed(1)}k€`}
            icon={<Euro className="h-4 w-4 text-primary" />}
          />
          <KPICard 
            label="Commandes" 
            value={orders}
            icon={<ShoppingBag className="h-4 w-4 text-blue-500" />}
          />
          <KPICard 
            label="Panier moy." 
            value={`${avgBasket.toFixed(0)}€`}
            icon={<Calculator className="h-4 w-4 text-purple-500" />}
          />
          <KPICard 
            label="Nouveaux" 
            value={offer.new_customers || 0}
            icon={<Users className="h-4 w-4 text-green-500" />}
          />
        </div>

        {/* Comparison CA declared vs real */}
        {hasMatchedData && matchedData && (
          <div className="bg-muted/30 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Comparaison CA</span>
              <Badge variant={Math.abs(matchedData.declared_vs_real_percent) < 5 ? "secondary" : "destructive"}>
                {matchedData.declared_vs_real_percent > 0 ? "+" : ""}{matchedData.declared_vs_real_percent.toFixed(1)}%
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
              <div>
                <p className="text-muted-foreground">CA déclaré offre</p>
                <p className="font-medium">{formatCurrency(offer.generated_sales)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">CA réel commandes</p>
                <p className="font-medium">{formatCurrency(matchedData.matched_sales)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Financial Waterfall */}
        <div className="space-y-1">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Décomposition financière
          </h3>
          
          {/* CA TTC */}
          <div className="flex items-center justify-between py-3 px-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-primary" />
              <span className="font-medium">CA TTC</span>
            </div>
            <span className="font-bold text-lg">{formatCurrency(sales)}</span>
          </div>
          
          {/* Deductions */}
          <div className="pl-4 border-l-2 border-red-200 dark:border-red-900 ml-4 space-y-0.5">
            <FinancialLineItem 
              label="Commission Uber Eats" 
              value={commission} 
              isNegative 
              percentage={sales > 0 ? (commission / sales) * 100 : 0}
            />
            
            {promos > 0 && (
              <FinancialLineItem 
                label="Promotions articles" 
                value={promos} 
                isNegative 
                percentage={sales > 0 ? (promos / sales) * 100 : 0}
                icon={<Gift className="h-3.5 w-3.5" />}
                iconColor="text-purple-500"
              />
            )}
            
            {refunds > 0 && (
              <FinancialLineItem 
                label="Remboursements" 
                value={refunds} 
                isNegative 
                percentage={sales > 0 ? (refunds / sales) * 100 : 0}
              />
            )}
            
            {mealVoucher > 0 && (
              <FinancialLineItem 
                label="Titres restaurant" 
                value={mealVoucher} 
                isNegative
                percentage={sales > 0 ? (mealVoucher / sales) * 100 : 0}
                icon={<CreditCard className="h-3.5 w-3.5" />}
                iconColor="text-blue-500"
                tooltip="Ce montant sera versé directement par l'organisme de titres restaurant."
              />
            )}
          </div>
          
          {/* Total Deductions */}
          <div className="flex items-center justify-between py-2 px-3 bg-red-500/5 rounded-lg mt-2">
            <span className="text-sm font-medium text-red-600">Total des frais</span>
            <span className="font-semibold text-red-600">-{formatCurrency(totalDeductions)}</span>
          </div>
          
          {/* Net Payout */}
          <div className="flex items-center justify-between py-3 px-3 bg-green-500/10 rounded-lg border border-green-500/30 mt-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-medium">Versement net</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-lg text-green-600">{formatCurrency(totalPayout)}</span>
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
        </div>

        <Separator className="my-6" />

        {/* Matched Orders Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Commandes de l'offre
            </h3>
            {matchedData && (
              <span className="text-sm text-muted-foreground">
                {matchedData.matched_orders_count} commande{matchedData.matched_orders_count > 1 ? "s" : ""}
              </span>
            )}
          </div>
          
          {isLoadingOrders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : matchedData?.matched_orders && matchedData.matched_orders.length > 0 ? (
            <ScrollArea className="h-[300px] border rounded-lg">
              <div>
                {matchedData.matched_orders.map((order, idx) => (
                  <OrderRow key={order.order_id} order={order} isFirst={idx === 0} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucune commande trouvée pour cette période</p>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* Estimated Offer Cost Analysis */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <PiggyBank className="h-4 w-4" />
            Analyse coût de l'offre
          </h3>
          
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <FinancialLineItem 
              label="Coût estimé (food cost)" 
              value={offer.estimated_cost} 
              isNegative
              tooltip="Estimation du coût de revient basée sur le food cost des produits en promotion"
            />
            
            {offer.uber_cofunding > 0 && (
              <FinancialLineItem 
                label={`Co-financement Uber (${offer.uber_funding_percent}%)`}
                value={offer.uber_cofunding}
                icon={<Percent className="h-3.5 w-3.5" />}
                iconColor="text-purple-500"
              />
            )}
            
            <Separator className="my-2" />
            
            <FinancialLineItem 
              label="Coût net de l'offre" 
              value={offer.estimated_cost - offer.uber_cofunding} 
              isNegative={offer.estimated_cost > offer.uber_cofunding}
              bold
            />
          </div>
        </div>

        <Separator className="my-6" />

        {/* Final Result */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Target className="h-4 w-4" />
            Résultat final
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Marge nette estimée</p>
              <p className={cn(
                "text-2xl font-bold",
                offer.net_margin >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(offer.net_margin)}
              </p>
            </div>
            
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">ROI estimé</p>
              <p className={cn(
                "text-2xl font-bold",
                offer.roi >= 50 ? "text-green-600" : offer.roi >= 0 ? "text-yellow-600" : "text-red-600"
              )}>
                {offer.roi.toFixed(0)}%
              </p>
            </div>
          </div>
          
          <div className="flex justify-center mt-4">
            {getProfitabilityBadge(offer.profitability_level, hasRealData ? profitability : undefined)}
          </div>
          
          {offer.new_customers > 0 && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 mt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Coût d'acquisition client</span>
              </div>
              <p className="text-lg font-bold text-purple-600 mt-1">
                {formatCurrency(offer.cost_per_acquisition)} / nouveau client
              </p>
              <p className="text-xs text-muted-foreground">
                {offer.new_customers} nouveaux clients acquis
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
