import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { calculatePearsonCorrelation } from "@/lib/correlationUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SimpleWeatherGaugeProps {
  temperatures: number[];
  precipitations: number[];
  revenueDeviations: number[];
  ordersDeviations: number[];
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

export function SimpleWeatherGauge({ 
  temperatures, 
  precipitations, 
  revenueDeviations, 
  ordersDeviations 
}: SimpleWeatherGaugeProps) {
  // Calculate correlations
  const rTempRevenue = calculatePearsonCorrelation(temperatures, revenueDeviations);
  const rPrecipOrders = calculatePearsonCorrelation(precipitations, ordersDeviations);
  
  const rSquaredTemp = rTempRevenue * rTempRevenue;
  const rSquaredPrecip = rPrecipOrders * rPrecipOrders;
  
  // Use the stronger correlation for the main display
  const useTemp = rSquaredTemp >= rSquaredPrecip;
  const mainRSquared = useTemp ? rSquaredTemp : rSquaredPrecip;
  const mainR = useTemp ? rTempRevenue : rPrecipOrders;
  const impact = getImpactLevel(mainRSquared);
  
  const Icon = mainR > 0.2 ? TrendingUp : mainR < -0.2 ? TrendingDown : Minus;
  
  // Generate messages
  let mainMessage: string;
  let subMessage: string;
  
  if (impact.percentage < 10) {
    mainMessage = "La météo n'influence pas significativement vos performances";
    subMessage = "D'autres facteurs (jour de la semaine, promotions) ont plus d'impact.";
  } else if (impact.percentage < 25) {
    mainMessage = "La météo a un léger impact sur vos performances";
    subMessage = "Légère influence détectée, mais d'autres facteurs sont plus déterminants.";
  } else if (impact.percentage < 50) {
    mainMessage = "La météo influence modérément vos performances";
    if (rTempRevenue > 0) {
      subMessage = "Les jours plus chauds semblent favoriser votre activité.";
    } else if (rTempRevenue < 0) {
      subMessage = "Les jours plus frais semblent favoriser votre activité.";
    } else {
      subMessage = "La température a un impact visible sur votre chiffre d'affaires.";
    }
  } else {
    mainMessage = "La météo a un fort impact sur vos performances";
    subMessage = "Planifiez vos ressources en fonction des prévisions météo.";
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
                      Ce pourcentage (R²) mesure l'impact de la météo sur vos performances,
                      après normalisation par jour de semaine pour éliminer les effets saisonniers.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">
              {subMessage}
            </p>
            
            {/* Quick stats */}
            {(rSquaredTemp >= 0.05 || rSquaredPrecip >= 0.05) && (
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Température → CA : </span>
                  <span className={`font-medium ${rTempRevenue > 0 ? "text-green-600 dark:text-green-400" : rTempRevenue < -0.1 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                    {rTempRevenue > 0.1 ? "↑ Chaud = Plus" : rTempRevenue < -0.1 ? "↓ Froid = Plus" : "Peu d'impact"}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Pluie → Commandes : </span>
                  <span className={`font-medium ${rPrecipOrders > 0.1 ? "text-green-600 dark:text-green-400" : rPrecipOrders < -0.1 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                    {rPrecipOrders > 0.1 ? "↑ Pluie = Plus" : rPrecipOrders < -0.1 ? "↓ Pluie = Moins" : "Peu d'impact"}
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
