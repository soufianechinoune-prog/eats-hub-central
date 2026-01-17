import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RestaurantStats {
  id: string;
  name: string;
  profitability: number; // Total encaissé (backward compat)
  margeUber: number; // What Uber pays / sales (primary metric)
  trBonus: number; // Meal voucher / sales
  totalSales: number;
  totalPayout: number;
  totalNetPayout: number;
  totalMealVoucher: number;
  totalOrders: number;
  uberFeeRate: number;
  promoRate: number;
  refundRate: number;
}

interface ProfitabilityRankingBarsProps {
  stats: RestaurantStats[];
  dateRange: { start: Date; end: Date };
}

export const ProfitabilityRankingBars = ({ stats, dateRange }: ProfitabilityRankingBarsProps) => {
  // Use margeUber as primary metric (without meal vouchers)
  const maxProfitability = useMemo(() => {
    if (!stats.length) return 100;
    return Math.max(...stats.map(s => s.margeUber), 80);
  }, [stats]);

  if (!stats.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Aucune donnée de rentabilité disponible pour cette période
      </div>
    );
  }

  const getBarColor = (profitability: number) => {
    if (profitability >= 70) return "bg-emerald-500";
    if (profitability >= 65) return "bg-green-500";
    if (profitability >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const getTextColor = (profitability: number) => {
    if (profitability >= 70) return "text-emerald-600";
    if (profitability >= 65) return "text-green-600";
    if (profitability >= 60) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {stats.map((restaurant, index) => {
          const barWidth = (restaurant.margeUber / maxProfitability) * 100;
          
          return (
            <div key={restaurant.id} className="flex items-center gap-3">
              {/* Rank */}
              <div className="w-6 text-center">
                <span className={cn(
                  "text-sm font-semibold",
                  index === 0 ? "text-amber-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-700" : "text-muted-foreground"
                )}>
                  {index + 1}
                </span>
              </div>
              
              {/* Restaurant name */}
              <div className="w-40 truncate text-sm font-medium">
                {restaurant.name}
              </div>
              
              {/* Bar */}
              <div className="flex-1 h-8 bg-muted/50 rounded-lg overflow-hidden relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "h-full rounded-lg transition-all duration-500",
                        getBarColor(restaurant.margeUber)
                      )}
                      style={{ width: `${Math.min(barWidth, 100)}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold">{restaurant.name}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-muted-foreground">CA TTC:</span>
                        <span>{restaurant.totalSales.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</span>
                        <span className="text-muted-foreground">Versement Uber:</span>
                        <span>{restaurant.totalNetPayout.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</span>
                        <span className="text-muted-foreground">Titres-resto:</span>
                        <span className="text-blue-600">+{restaurant.totalMealVoucher.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</span>
                        <span className="text-muted-foreground">Commandes:</span>
                        <span>{restaurant.totalOrders}</span>
                        <span className="text-muted-foreground">Comm. Uber:</span>
                        <span>{restaurant.uberFeeRate.toFixed(1)}%</span>
                        <span className="text-muted-foreground">Promos:</span>
                        <span>{restaurant.promoRate.toFixed(1)}%</span>
                        <span className="text-muted-foreground">Remboursements:</span>
                        <span>{restaurant.refundRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {/* Marge Uber value */}
              <div className={cn(
                "w-16 text-right text-sm font-bold",
                getTextColor(restaurant.margeUber)
              )}>
                {restaurant.margeUber.toFixed(1)}%
              </div>
              
              {/* TR Bonus */}
              <div className="w-14 text-right text-xs text-blue-600 font-medium">
                +{restaurant.trBonus.toFixed(1)}%
              </div>
            </div>
          );
        })}
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-4 text-xs text-muted-foreground border-t mt-4">
          <div className="font-medium">Marge Uber (hors TR)</div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>≥ 70%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>65-70%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span>60-65%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>&lt; 60%</span>
          </div>
          <div className="flex items-center gap-1.5 border-l pl-4">
            <span className="text-blue-600 font-medium">+X%</span>
            <span>= TR Bonus</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
