import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, HelpCircle, Lightbulb, BarChart3, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calculatePearsonCorrelation, getCorrelationStrength, getDetailedExplanation } from "@/lib/correlationUtils";

interface CorrelationKPIProps {
  ratings: number[];
  values: number[];
  label: string;
  xLabel?: string;
}

export function CorrelationKPI({ ratings, values, label, xLabel = "Notes" }: CorrelationKPIProps) {
  const r = calculatePearsonCorrelation(ratings, values);
  const rSquared = r * r;
  const xLabelLower = xLabel.toLowerCase();
  const { label: strengthLabel, color, description } = getCorrelationStrength(r, xLabelLower);
  const explanation = getDetailedExplanation(r, rSquared, label, xLabelLower);
  
  const Icon = r > 0.2 ? TrendingUp : r < -0.2 ? TrendingDown : Minus;
  
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Corrélation {xLabel} / {label}
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted">
                <HelpCircle className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">Comprendre cette statistique</h4>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                {/* R² Explanation */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="text-primary">{(rSquared * 100).toFixed(0)}%</span>
                    <span className="text-muted-foreground">— Que signifie ce chiffre ?</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {explanation.shortDescription}
                  </p>
                </div>
                
                {/* What it means */}
                <div className="space-y-1.5">
                  <h5 className="text-xs font-medium text-foreground">Ce que ça veut dire</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {explanation.whatItMeans}
                  </p>
                </div>
                
                {/* R Coefficient */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-medium">Coefficient R = {r.toFixed(3)}</span>
                    <span className={`text-xs ${color}`}>({strengthLabel})</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {explanation.rExplanation}
                  </p>
                </div>
                
                {/* Action Advice */}
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">Conseil</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {explanation.actionAdvice}
                  </p>
                </div>
                
                {/* Interpretation */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-start gap-1.5">
                    <ArrowRight className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      {explanation.interpretation}
                    </p>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
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
