import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OfferProfitability } from "@/hooks/useOfferProfitability";

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

export function OfferDetailSheet({ open, onOpenChange, offer }: OfferDetailSheetProps) {
  if (!offer) return null;

  const hasRealData = offer.has_real_data;
  
  // Sales and metrics
  const sales = hasRealData ? (offer.real_sales || 0) : offer.generated_sales;
  const orders = hasRealData ? (offer.real_orders_count || offer.orders) : offer.orders;
  const avgBasket = orders > 0 ? sales / orders : 0;
  
  // Financial breakdown (real or estimated)
  const commission = hasRealData ? (offer.real_commission || 0) : offer.commission;
  const promos = hasRealData ? (offer.real_promos || 0) : 0;
  const refunds = hasRealData ? (offer.real_refunds || 0) : 0;
  const payout = hasRealData ? (offer.real_payout || 0) : (offer.generated_sales - offer.commission);
  const mealVoucher = hasRealData ? (offer.real_meal_voucher || 0) : 0;
  const totalPayout = hasRealData ? (offer.real_total_payout || 0) : payout;
  const profitability = hasRealData ? (offer.real_profitability || 0) : (sales > 0 ? (payout / sales) * 100 : 0);
  
  // Calculate total deductions
  const totalDeductions = commission + promos + refunds + mealVoucher;
  
  // Period
  const startDate = offer.start_date ? parseISO(offer.start_date) : null;
  const endDate = offer.end_date ? parseISO(offer.end_date) : null;
  const durationDays = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <SheetTitle className="text-xl">
                {offer.product || offer.title || "Offre"}
              </SheetTitle>
              <div className="flex flex-wrap gap-2">
                {getOfferTypeBadge(offer.offer_type)}
                {hasRealData ? (
                  <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Données réelles
                  </Badge>
                ) : (
                  <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Estimations
                  </Badge>
                )}
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
                tooltip="Ce montant sera versé directement par l'organisme de titres restaurant (Edenred, Swile, etc.), séparément du virement Uber."
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
              <span className="font-medium">Versement Uber</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-lg text-green-600">{formatCurrency(payout)}</span>
              <span className={cn(
                "text-xs ml-2 px-2 py-0.5 rounded-full",
                payout / sales >= 0.5 ? "bg-green-500/20 text-green-700" : 
                payout / sales >= 0.4 ? "bg-yellow-500/20 text-yellow-700" : 
                "bg-red-500/20 text-red-700"
              )}>
                {sales > 0 ? ((payout / sales) * 100).toFixed(1) : 0}% du CA
              </span>
            </div>
          </div>
          
          {/* Total with meal vouchers */}
          {mealVoucher > 0 && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Total à encaisser</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-blue-600">{formatCurrency(totalPayout)}</span>
                  <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700">
                    {profitability.toFixed(1)}% du CA
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                = Versement Uber ({formatCurrency(payout)}) + Titres restaurant ({formatCurrency(mealVoucher)})
              </p>
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
