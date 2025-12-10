import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Euro,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
} from "lucide-react";

interface RevenuePerVisitKPIProps {
  visits: number;
  revenue: number;
  previousVisits?: number;
  previousRevenue?: number;
  className?: string;
}

export function RevenuePerVisitKPI({
  visits,
  revenue,
  previousVisits,
  previousRevenue,
  className,
}: RevenuePerVisitKPIProps) {
  const revenuePerVisit = useMemo(() => {
    return visits > 0 ? revenue / visits : 0;
  }, [visits, revenue]);

  const previousRevenuePerVisit = useMemo(() => {
    if (!previousVisits || !previousRevenue) return null;
    return previousVisits > 0 ? previousRevenue / previousVisits : 0;
  }, [previousVisits, previousRevenue]);

  const variation = useMemo(() => {
    if (!previousRevenuePerVisit) return null;
    if (previousRevenuePerVisit === 0) return revenuePerVisit > 0 ? 100 : 0;
    return ((revenuePerVisit - previousRevenuePerVisit) / previousRevenuePerVisit) * 100;
  }, [revenuePerVisit, previousRevenuePerVisit]);

  const isPositive = variation !== null && variation > 0;
  const isNegative = variation !== null && variation < 0;
  const isNeutral = variation !== null && Math.abs(variation) < 0.5;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "overflow-hidden border-2 transition-all hover:shadow-lg",
        "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
        className
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Euro className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">CA par Visite</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {revenuePerVisit.toFixed(2)} €
                  </p>
                </div>
              </div>

              {/* Comparison with previous period */}
              {variation !== null && (
                <div className="flex items-center gap-2 pt-1">
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-sm font-medium",
                      isNeutral && "text-muted-foreground",
                      isPositive && "text-emerald-600",
                      isNegative && "text-red-500"
                    )}
                  >
                    {isNeutral ? (
                      <Minus className="h-3.5 w-3.5" />
                    ) : isPositive ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {isPositive && "+"}
                    {variation.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    vs période préc.
                  </span>
                </div>
              )}
            </div>

            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[250px]">
                  <p className="font-semibold mb-1">CA par Visite</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Mesure la valeur générée par chaque visite sur votre page.
                  </p>
                  <p className="text-xs font-mono bg-muted/50 p-1 rounded">
                    = CA Total ÷ Nombre de visites
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Un CA/visite élevé indique une bonne efficacité de conversion
                    et un panier moyen attractif.
                  </p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>

          {/* Mini breakdown */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-emerald-500/20 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {visits.toLocaleString("fr-FR")} visites
            </div>
            <div className="flex items-center gap-1">
              <Euro className="h-3 w-3" />
              {revenue.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € CA
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
