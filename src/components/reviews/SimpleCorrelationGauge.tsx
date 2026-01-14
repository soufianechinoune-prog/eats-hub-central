import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { calculatePearsonCorrelation, calculateLinearRegression } from "@/lib/correlationUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SimpleCorrelationGaugeProps {
  ratings: number[];
  revenues: number[];
  orders: number[];
}

function getImpactLevel(rSquared: number): {
  label: string;
  color: string;
  bgColor: string;
  percentage: number;
} {
  const percentage = Math.round(rSquared * 100);
  
  if (percentage >= 40) {
    return {
      label: "Fort",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500",
      percentage,
    };
  } else if (percentage >= 20) {
    return {
      label: "Modéré",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500",
      percentage,
    };
  } else {
    return {
      label: "Faible",
      color: "text-muted-foreground",
      bgColor: "bg-muted-foreground",
      percentage,
    };
  }
}

function formatRevenueImpact(slope: number): string {
  if (Math.abs(slope) < 100) {
    return `${slope >= 0 ? "+" : ""}${Math.round(slope)} €`;
  }
  return `${slope >= 0 ? "+" : ""}${(slope / 1000).toFixed(1)}k €`;
}

export function SimpleCorrelationGauge({ ratings, revenues, orders }: SimpleCorrelationGaugeProps) {
  // Calculate correlation for revenue
  const rRevenue = calculatePearsonCorrelation(ratings, revenues);
  const rSquaredRevenue = rRevenue * rRevenue;
  const regressionRevenue = calculateLinearRegression(ratings, revenues);
  
  // Calculate correlation for orders
  const rOrders = calculatePearsonCorrelation(ratings, orders);
  const rSquaredOrders = rOrders * rOrders;
  const regressionOrders = calculateLinearRegression(ratings, orders);
  
  // Use the stronger correlation for the main display
  const useRevenue = rSquaredRevenue >= rSquaredOrders;
  const mainRSquared = useRevenue ? rSquaredRevenue : rSquaredOrders;
  const mainR = useRevenue ? rRevenue : rOrders;
  const impact = getImpactLevel(mainRSquared);
  
  // Calculate what 0.1 point improvement would mean
  const revenuePerPoint = regressionRevenue.slope;
  const ordersPerPoint = regressionOrders.slope;
  const revenueImpactPer01 = revenuePerPoint * 0.1;
  const ordersImpactPer01 = ordersPerPoint * 0.1;
  
  const Icon = mainR > 0.2 ? TrendingUp : mainR < -0.2 ? TrendingDown : Minus;
  
  // Generate the main message
  let mainMessage: string;
  let subMessage: string;
  
  if (impact.percentage < 10) {
    mainMessage = "Vos notes n'influencent pas significativement vos performances";
    subMessage = "D'autres facteurs (météo, jour, promotions) ont plus d'impact sur votre activité.";
  } else if (impact.percentage < 25) {
    mainMessage = "Vos notes ont un léger impact sur vos performances";
    subMessage = "Il existe une relation, mais d'autres facteurs sont plus déterminants.";
  } else if (impact.percentage < 50) {
    mainMessage = "Vos notes influencent modérément vos performances";
    if (revenuePerPoint > 0) {
      subMessage = `Estimation : gagner 0.1 point pourrait augmenter votre CA de ${formatRevenueImpact(revenueImpactPer01)}/jour.`;
    } else {
      subMessage = "Améliorer vos notes devrait avoir un effet positif mesurable.";
    }
  } else {
    mainMessage = "Vos notes ont un fort impact sur vos performances";
    if (revenuePerPoint > 0) {
      subMessage = `Estimation : gagner 0.1 point pourrait augmenter votre CA de ${formatRevenueImpact(revenueImpactPer01)}/jour.`;
    } else {
      subMessage = "La satisfaction client est directement liée à votre chiffre d'affaires.";
    }
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Gauge Visual */}
          <div className="flex-shrink-0">
            <div className="relative w-32 h-32 mx-auto md:mx-0">
              {/* Background circle */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/20"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${impact.percentage * 2.51} 251`}
                  className={impact.bgColor}
                />
              </svg>
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Icon className={`h-5 w-5 mb-1 ${impact.color}`} />
                <span className={`text-2xl font-bold ${impact.color}`}>
                  {impact.percentage}%
                </span>
                <span className={`text-xs font-medium ${impact.color}`}>
                  {impact.label}
                </span>
              </div>
            </div>
          </div>
          
          {/* Message */}
          <div className="flex-1 space-y-2">
            <div className="flex items-start gap-2">
              <h3 className="text-lg font-semibold">
                {mainMessage}
              </h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted mt-0.5">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">
                      Ce pourcentage (R²) indique quelle part des variations de votre CA peut être expliquée par vos notes.
                      Calculé sur une moyenne mobile de 90 jours.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">
              {subMessage}
            </p>
            
            {/* Quick stats */}
            {impact.percentage >= 15 && (
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Impact sur CA : </span>
                  <span className={`font-medium ${rRevenue > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatRevenueImpact(revenuePerPoint)}/point
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Impact sur commandes : </span>
                  <span className={`font-medium ${rOrders > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {ordersPerPoint >= 0 ? "+" : ""}{ordersPerPoint.toFixed(1)}/point
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
