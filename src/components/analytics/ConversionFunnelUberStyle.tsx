import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConversionFunnelUberStyleProps {
  data: {
    visits: number;
    views: number;
    cart: number;
    orders: number;
  };
  previousData?: {
    visits: number;
    views: number;
    cart: number;
    orders: number;
  };
  animated?: boolean;
  className?: string;
}

// Format number with K suffix
const formatNumber = (num: number): string => {
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(1);
    // Remove trailing .0
    return formatted.endsWith('.0') 
      ? formatted.slice(0, -2) + 'K' 
      : formatted.replace('.', ',') + 'K';
  }
  return num.toLocaleString('fr-FR');
};

// Calculate variation percentage
const calcVariation = (current: number, previous: number): number | null => {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

export function ConversionFunnelUberStyle({
  data,
  previousData,
  animated = true,
  className,
}: ConversionFunnelUberStyleProps) {
  // Define funnel steps
  const steps = useMemo(() => [
    { 
      key: "visits", 
      label: "Utilisateurs ayant visité votre établissement", 
      value: data.visits,
      previousValue: previousData?.visits ?? 0
    },
    { 
      key: "views", 
      label: "Clients ayant consulté le menu", 
      value: data.views,
      previousValue: previousData?.views ?? 0
    },
    { 
      key: "cart", 
      label: "Clients ayant ajouté des articles au panier", 
      value: data.cart,
      previousValue: previousData?.cart ?? 0
    },
    { 
      key: "orders", 
      label: "Clients ayant passé commande", 
      value: data.orders,
      previousValue: previousData?.orders ?? 0
    },
  ], [data, previousData]);

  // Overall menu conversion rate: orders / menu views (comme Uber Eats)
  const menuConversionRate = data.views > 0 ? (data.orders / data.views) * 100 : 0;
  const previousMenuConversionRate = previousData && previousData.views > 0 
    ? (previousData.orders / previousData.views) * 100 
    : null;
  const menuRateVariation = previousMenuConversionRate 
    ? menuConversionRate - previousMenuConversionRate 
    : null;

  // Max value for bar height calculation
  const maxValue = data.visits;
  const maxBarHeight = 180; // pixels

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">Tunnel de conversion</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]">
                  <p className="text-sm">
                    Visualisez le parcours de vos clients depuis la visite jusqu'à la commande.
                    Identifiez où vous perdez le plus de conversions.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Télécharger
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Global conversion rate header */}
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{Math.round(menuConversionRate)} %</span>
            {menuRateVariation !== null && (
              <span className={cn(
                "text-sm font-medium",
                menuRateVariation >= 0 ? "text-emerald-600" : "text-red-500"
              )}>
                {menuRateVariation >= 0 ? "↑" : "↓"} {Math.abs(menuRateVariation).toFixed(0)} %
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Taux de conversion du menu</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-3 h-3 bg-primary rounded-sm" />
            <span className="text-xs text-muted-foreground">Utilisateurs</span>
          </div>
        </div>

        {/* Funnel bars */}
        <div className="flex items-end justify-between gap-4 px-4">
          {steps.map((step, index) => {
            const barHeight = maxValue > 0 
              ? (step.value / maxValue) * maxBarHeight 
              : 0;
            const variation = calcVariation(step.value, step.previousValue);

            return (
              <motion.div
                key={step.key}
                initial={animated ? { opacity: 0, y: 20 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="flex-1 flex flex-col items-center"
              >
                {/* Bar container */}
                <div 
                  className="w-full flex items-end justify-center"
                  style={{ height: maxBarHeight }}
                >
                  <motion.div
                    initial={animated ? { height: 0 } : false}
                    animate={{ height: Math.max(barHeight, 8) }}
                    transition={{ delay: index * 0.1 + 0.2, duration: 0.5, ease: "easeOut" }}
                    className="w-full max-w-[100px] bg-primary rounded-t-md relative group cursor-pointer"
                    style={{ minHeight: 8 }}
                  >
                    {/* Hover tooltip effect */}
                    <div className="absolute inset-0 bg-primary/80 rounded-t-md opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                </div>

                {/* Divider line */}
                <div className="w-full h-px bg-border mt-2" />

                {/* Label */}
                <p className="text-xs text-muted-foreground text-center mt-3 leading-tight min-h-[32px] px-1">
                  {step.label}
                </p>

                {/* Value and variation */}
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-xl font-bold">{formatNumber(step.value)}</span>
                  {variation !== null && (
                    <span className={cn(
                      "text-xs font-medium",
                      variation >= 0 ? "text-emerald-600" : "text-red-500"
                    )}>
                      {variation >= 0 ? "↑" : "↓"} {Math.abs(variation).toFixed(0)} %
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
