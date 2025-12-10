import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Users,
  Eye,
  ShoppingCart,
  Package,
  Droplets,
  AlertTriangle,
  TrendingDown,
} from "lucide-react";

interface ConversionLeakyBucketProps {
  data: {
    visits: number;
    views: number;
    cart: number;
    orders: number;
  };
  animated?: boolean;
  className?: string;
}

interface FunnelStep {
  key: string;
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export function ConversionLeakyBucket({
  data,
  animated = true,
  className,
}: ConversionLeakyBucketProps) {
  const steps: FunnelStep[] = useMemo(() => [
    { key: "visits", label: "Visites", value: data.visits, icon: Users, color: "hsl(var(--chart-1))", bgColor: "hsl(var(--chart-1) / 0.15)" },
    { key: "views", label: "Vues menu", value: data.views, icon: Eye, color: "hsl(var(--chart-2))", bgColor: "hsl(var(--chart-2) / 0.15)" },
    { key: "cart", label: "Ajouts panier", value: data.cart, icon: ShoppingCart, color: "hsl(var(--chart-3))", bgColor: "hsl(var(--chart-3) / 0.15)" },
    { key: "orders", label: "Commandes", value: data.orders, icon: Package, color: "hsl(var(--chart-4))", bgColor: "hsl(var(--chart-4) / 0.15)" },
  ], [data]);

  // Calculate losses between each step
  const losses = useMemo(() => {
    const result = [];
    for (let i = 0; i < steps.length - 1; i++) {
      const current = steps[i].value;
      const next = steps[i + 1].value;
      const lost = current - next;
      const lossRate = current > 0 ? (lost / current) * 100 : 0;
      result.push({
        from: steps[i].label,
        to: steps[i + 1].label,
        lost,
        lossRate,
        retained: current > 0 ? (next / current) * 100 : 0,
      });
    }
    return result;
  }, [steps]);

  // Find the biggest leak
  const biggestLeak = useMemo(() => {
    return losses.reduce((max, loss, index) => 
      loss.lossRate > max.lossRate ? { ...loss, index } : max
    , { ...losses[0], index: 0 });
  }, [losses]);

  // Overall conversion rate
  const overallRate = data.visits > 0 ? (data.orders / data.visits) * 100 : 0;

  // Max value for bar width calculation
  const maxValue = data.visits;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-red-500" />
            <span>Analyse des Pertes du Funnel</span>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1.5 cursor-help">
                  <Users className="h-3 w-3" />
                  {data.visits.toLocaleString('fr-FR')} visites
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total des visites sur la période sélectionnée</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2 pt-4">
        {steps.map((step, index) => {
          const barWidth = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
          const loss = index < losses.length ? losses[index] : null;
          const isBiggestLeak = loss && index === biggestLeak.index;
          const Icon = step.icon;

          return (
            <div key={step.key}>
              {/* Step bar */}
              <motion.div
                initial={animated ? { opacity: 0, x: -20 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="relative"
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: step.bgColor }}
                  >
                    <Icon className="h-4 w-4" style={{ color: step.color }} />
                  </div>
                  
                  {/* Label and bar container */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{step.label}</span>
                      <span className="text-sm font-bold tabular-nums">
                        {step.value.toLocaleString('fr-FR')}
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="h-7 bg-muted/50 rounded-lg overflow-hidden relative">
                      <motion.div
                        initial={animated ? { width: 0 } : false}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ delay: index * 0.1 + 0.2, duration: 0.5, ease: "easeOut" }}
                        className="h-full rounded-lg relative"
                        style={{ 
                          background: `linear-gradient(90deg, ${step.color}, ${step.color}cc)`,
                        }}
                      >
                        {/* Percentage inside bar */}
                        {barWidth > 20 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/90">
                            {barWidth.toFixed(1)}%
                          </span>
                        )}
                      </motion.div>
                      {/* Percentage outside bar when too small */}
                      {barWidth <= 20 && barWidth > 0 && (
                        <span 
                          className="absolute top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground"
                          style={{ left: `calc(${barWidth}% + 8px)` }}
                        >
                          {barWidth.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Loss indicator between steps */}
              {loss && (
                <motion.div
                  initial={animated ? { opacity: 0, scale: 0.8 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.4, duration: 0.3 }}
                  className={cn(
                    "ml-12 my-2 flex items-center gap-2 py-2 px-3 rounded-lg border-l-4",
                    isBiggestLeak 
                      ? "bg-red-500/10 border-red-500" 
                      : "bg-muted/30 border-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-1.5",
                    isBiggestLeak ? "text-red-500" : "text-muted-foreground"
                  )}>
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      -{loss.lost.toLocaleString('fr-FR')} perdus
                    </span>
                  </div>
                  
                  <Badge 
                    variant={isBiggestLeak ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    -{loss.lossRate.toFixed(1)}%
                  </Badge>
                  
                  {isBiggestLeak && (
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="h-4 w-4 text-red-500 ml-auto cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <p className="font-semibold mb-1">⚠️ Plus grosse fuite</p>
                          <p className="text-xs text-muted-foreground">
                            C'est entre "{loss.from}" et "{loss.to}" que vous perdez le plus de clients.
                            Concentrez vos efforts d'amélioration ici.
                          </p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  )}
                </motion.div>
              )}
            </div>
          );
        })}

        {/* Summary footer */}
        <motion.div
          initial={animated ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.3 }}
          className="mt-6 pt-4 border-t border-border"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Taux de conversion global :</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-base font-bold px-3 py-1",
                  overallRate >= 10 && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                  overallRate >= 5 && overallRate < 10 && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                  overallRate < 5 && "bg-red-500/10 text-red-600 border-red-500/30"
                )}
              >
                {overallRate.toFixed(2)}%
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Plus grosse perte :</span>
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {biggestLeak.from} → {biggestLeak.to}
              </Badge>
            </div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
