import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { calculatePearsonCorrelation, getCorrelationStrength } from "@/lib/correlationUtils";

interface CorrelationKPIProps {
  ratings: number[];
  values: number[];
  label: string;
}

export function CorrelationKPI({ ratings, values, label }: CorrelationKPIProps) {
  const r = calculatePearsonCorrelation(ratings, values);
  const rSquared = r * r;
  const { label: strengthLabel, color, description } = getCorrelationStrength(r);
  
  const Icon = r > 0.2 ? TrendingUp : r < -0.2 ? TrendingDown : Minus;
  
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Corrélation Notes / {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${r > 0.2 ? 'bg-green-500/10' : r < -0.2 ? 'bg-red-500/10' : 'bg-muted'}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {(rSquared * 100).toFixed(0)}%
              </span>
              <span className={`text-sm font-medium ${color}`}>
                {strengthLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              R² = {rSquared.toFixed(3)} (R = {r.toFixed(3)})
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
