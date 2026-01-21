import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { 
  Euro, 
  Tag, 
  Percent, 
  AlertTriangle, 
  ArrowRight,
  CreditCard,
  TrendingUp,
  Minus
} from "lucide-react";

interface WaterfallData {
  totalSales: number;
  totalPromo: number;
  totalUberFee: number;
  totalRefund: number;
  totalNetPayout: number;
  totalMealVoucher: number;
}

interface ProfitabilityWaterfallProps {
  data: WaterfallData;
  className?: string;
}

// Helper to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString('fr-FR', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  });
};

// Helper to format percentage
const formatPercent = (value: number) => {
  if (!isFinite(value) || isNaN(value)) return "--";
  return `${value.toFixed(1)}%`;
};

interface WaterfallRowProps {
  label: string;
  value: number;
  percentage: number;
  isSubtraction?: boolean;
  isAddition?: boolean;
  isResult?: boolean;
  icon?: React.ReactNode;
  highlight?: "green" | "red" | "blue" | "amber" | "primary";
  indent?: boolean;
}

function WaterfallRow({ 
  label, 
  value, 
  percentage, 
  isSubtraction = false, 
  isAddition = false,
  isResult = false, 
  icon,
  highlight,
  indent = false
}: WaterfallRowProps) {
  const displayValue = isSubtraction ? -Math.abs(value) : value;
  
  const bgColor = highlight === "green" ? "bg-green-500/10 border-green-500/30" :
                  highlight === "red" ? "bg-red-500/10 border-red-500/30" :
                  highlight === "blue" ? "bg-blue-500/10 border-blue-500/30" :
                  highlight === "amber" ? "bg-amber-500/10 border-amber-500/30" :
                  highlight === "primary" ? "bg-primary/10 border-primary/30" :
                  "bg-transparent border-transparent";
  
  const textColor = highlight === "green" ? "text-green-600" :
                    highlight === "red" ? "text-red-600" :
                    highlight === "blue" ? "text-blue-600" :
                    highlight === "amber" ? "text-amber-600" :
                    highlight === "primary" ? "text-primary" :
                    isSubtraction ? "text-red-600" :
                    isAddition ? "text-green-600" :
                    "text-foreground";

  return (
    <div className={cn(
      "flex items-center justify-between py-2.5 px-3 rounded-lg border transition-colors",
      bgColor,
      indent && "ml-4",
      isResult && "font-semibold"
    )}>
      <div className="flex items-center gap-2">
        {icon && <span className={textColor}>{icon}</span>}
        <span className={cn("text-sm", isResult && "font-medium")}>
          {isSubtraction && !isResult && "- "}
          {isAddition && !isResult && "+ "}
          {label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          isSubtraction ? "bg-red-500/10 text-red-600" :
          isAddition ? "bg-green-500/10 text-green-600" :
          highlight ? `${bgColor} ${textColor}` :
          "bg-muted text-muted-foreground"
        )}>
          {formatPercent(percentage)}
        </span>
        <span className={cn(
          "font-mono tabular-nums",
          textColor,
          isResult && "text-lg font-bold"
        )}>
          {displayValue >= 0 ? formatCurrency(displayValue) : `-${formatCurrency(Math.abs(displayValue))}`}
        </span>
      </div>
    </div>
  );
}

export function ProfitabilityWaterfall({ data, className }: ProfitabilityWaterfallProps) {
  const calculations = useMemo(() => {
    const { totalSales, totalPromo, totalUberFee, totalRefund, totalNetPayout, totalMealVoucher } = data;
    
    // Ventes nettes = Ventes brutes - Promos
    const netSales = totalSales - totalPromo;
    
    // Marge Uber = Net Payout / Ventes TTC
    const margeUber = totalSales > 0 ? (totalNetPayout / totalSales) * 100 : 0;
    
    // Marge économique = Net Payout / Ventes Nettes
    const margeEconomique = netSales > 0 ? (totalNetPayout / netSales) * 100 : 0;
    
    // TR Bonus = Meal Voucher / Ventes TTC
    const trBonus = totalSales > 0 ? (totalMealVoucher / totalSales) * 100 : 0;
    
    // Total encaissé
    const totalEncaisse = totalNetPayout + totalMealVoucher;
    const totalEncaisseRate = totalSales > 0 ? (totalEncaisse / totalSales) * 100 : 0;
    
    // Percentages based on gross sales
    const promoRate = totalSales > 0 ? (totalPromo / totalSales) * 100 : 0;
    const uberFeeRate = totalSales > 0 ? (totalUberFee / totalSales) * 100 : 0;
    const refundRate = totalSales > 0 ? (totalRefund / totalSales) * 100 : 0;
    const netSalesRate = totalSales > 0 ? (netSales / totalSales) * 100 : 0;
    
    return {
      netSales,
      margeUber,
      margeEconomique,
      trBonus,
      totalEncaisse,
      totalEncaisseRate,
      promoRate,
      uberFeeRate,
      refundRate,
      netSalesRate,
    };
  }, [data]);

  const { totalSales, totalPromo, totalUberFee, totalRefund, totalNetPayout, totalMealVoucher } = data;

  return (
    <Card className={cn("backdrop-blur-xl bg-card/80 border-border/50", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          Décomposition de la rentabilité
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* CA TTC (Base) */}
        <WaterfallRow
          label="Ventes TTC (CA brut)"
          value={totalSales}
          percentage={100}
          icon={<Euro className="h-4 w-4" />}
          highlight="primary"
        />
        
        {/* Deductions */}
        <div className="pl-4 border-l-2 border-red-200 dark:border-red-900 ml-4 space-y-1 py-2">
          <WaterfallRow
            label="Promotions articles"
            value={totalPromo}
            percentage={calculations.promoRate}
            isSubtraction
            icon={<Tag className="h-4 w-4" />}
          />
          
          {/* Net Sales subtotal */}
          <div className="flex items-center gap-2 py-2 px-3">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">= Ventes Nettes (ce que le client paie)</span>
            <span className="ml-auto font-medium">
              {formatCurrency(calculations.netSales)}
              <span className="text-xs text-muted-foreground ml-2">
                ({formatPercent(calculations.netSalesRate)})
              </span>
            </span>
          </div>
          
          <WaterfallRow
            label="Frais Uber Eats"
            value={totalUberFee}
            percentage={calculations.uberFeeRate}
            isSubtraction
            icon={<Percent className="h-4 w-4" />}
          />
          
          <WaterfallRow
            label="Remboursements"
            value={totalRefund}
            percentage={calculations.refundRate}
            isSubtraction
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>
        
        <Separator className="my-2" />
        
        {/* Net Payout */}
        <WaterfallRow
          label="Versement Uber (Marge Uber)"
          value={totalNetPayout}
          percentage={calculations.margeUber}
          isResult
          icon={<TrendingUp className="h-4 w-4" />}
          highlight="green"
        />
        
        {/* Meal Vouchers */}
        {totalMealVoucher > 0 && (
          <>
            <WaterfallRow
              label="Titres-restaurant (TR Bonus)"
              value={totalMealVoucher}
              percentage={calculations.trBonus}
              isAddition
              icon={<CreditCard className="h-4 w-4" />}
              highlight="blue"
            />
            
            <WaterfallRow
              label="Total Encaissé"
              value={calculations.totalEncaisse}
              percentage={calculations.totalEncaisseRate}
              isResult
              icon={<Euro className="h-4 w-4" />}
              highlight="amber"
            />
          </>
        )}
        
        <Separator className="my-3" />
        
        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-xs text-muted-foreground">Marge Uber (base brute)</p>
            <p className="text-2xl font-bold text-green-600">
              {formatPercent(calculations.margeUber)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Net Payout / Ventes TTC
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-xs text-muted-foreground">Marge économique (base nette)</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatPercent(calculations.margeEconomique)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Net Payout / (Ventes - Promos)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
