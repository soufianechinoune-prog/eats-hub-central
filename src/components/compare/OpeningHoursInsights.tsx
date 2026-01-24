import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Lightbulb, 
  Clock, 
  Calendar,
  ArrowRight,
  Zap
} from "lucide-react";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

interface RestaurantStats {
  id: string;
  name: string;
  totalHoursPerWeek: number;
  totalUberHours: number;
  totalDeliverooHours: number;
  daysCovered: number;
  missingDays: number[];
  totalRevenue: number;
  totalOrders: number;
  revenuePerHour: number;
  uberDays: number[];
  deliverooDays: number[];
}

interface OpeningHoursInsightsProps {
  restaurantStats: RestaurantStats[];
  networkAvgRevenuePerHour: number;
  networkAvgHours: number;
}

export const OpeningHoursInsights = ({ 
  restaurantStats, 
  networkAvgRevenuePerHour,
  networkAvgHours 
}: OpeningHoursInsightsProps) => {
  
  // Calculer les insights
  const insights = useMemo(() => {
    if (!restaurantStats.length) return {
      extensionOpportunities: [],
      missingDaysImpact: [],
      underperformingSlots: [],
      platformGaps: [],
      topPerformers: [],
      needsAttention: []
    };

    // 1. Opportunités d'extension - CA/h élevé mais peu d'heures
    const extensionOpportunities = restaurantStats
      .filter(r => r.revenuePerHour > networkAvgRevenuePerHour && r.totalHoursPerWeek < networkAvgHours)
      .map(r => {
        const potentialExtraHours = Math.min(14, networkAvgHours - r.totalHoursPerWeek); // Max 2h par jour
        const potentialWeeklyGain = Math.round(potentialExtraHours * r.revenuePerHour);
        const potentialMonthlyGain = Math.round(potentialWeeklyGain * 4.3);
        return {
          ...r,
          potentialExtraHours: Math.round(potentialExtraHours * 10) / 10,
          potentialWeeklyGain,
          potentialMonthlyGain
        };
      })
      .sort((a, b) => b.potentialMonthlyGain - a.potentialMonthlyGain);

    // 2. Impact des jours manquants
    const avgDailyRevenue = networkAvgRevenuePerHour * (networkAvgHours / 7);
    const missingDaysImpact = restaurantStats
      .filter(r => r.missingDays.length > 0)
      .map(r => {
        const estimatedLostRevenue = Math.round(r.missingDays.length * avgDailyRevenue * 4.3);
        return {
          ...r,
          estimatedLostRevenue
        };
      })
      .sort((a, b) => b.estimatedLostRevenue - a.estimatedLostRevenue);

    // 3. Restaurants sous-performants (CA/h < 50% de la moyenne)
    const underperformingSlots = restaurantStats
      .filter(r => r.revenuePerHour > 0 && r.revenuePerHour < networkAvgRevenuePerHour * 0.5)
      .map(r => ({
        ...r,
        percentBelowAvg: Math.round((1 - r.revenuePerHour / networkAvgRevenuePerHour) * 100)
      }))
      .sort((a, b) => b.percentBelowAvg - a.percentBelowAvg);

    // 4. Écarts Uber/Deliveroo
    const platformGaps = restaurantStats
      .filter(r => {
        const hoursDiff = Math.abs(r.totalUberHours - r.totalDeliverooHours);
        return hoursDiff > 10 && r.totalUberHours > 0 && r.totalDeliverooHours > 0;
      })
      .map(r => ({
        ...r,
        hoursDiff: Math.abs(r.totalUberHours - r.totalDeliverooHours),
        lowerPlatform: r.totalUberHours < r.totalDeliverooHours ? 'uber' : 'deliveroo',
        potentialHarmonizationGain: Math.round(
          Math.abs(r.totalUberHours - r.totalDeliverooHours) * r.revenuePerHour * 0.5 * 4.3
        )
      }));

    // 5. Top performers
    const topPerformers = restaurantStats
      .filter(r => r.revenuePerHour >= networkAvgRevenuePerHour * 1.2)
      .slice(0, 3);

    // 6. Restaurants nécessitant attention
    const needsAttention = restaurantStats
      .filter(r => 
        r.missingDays.length >= 2 || 
        r.totalHoursPerWeek < networkAvgHours * 0.7 ||
        (r.revenuePerHour > 0 && r.revenuePerHour < networkAvgRevenuePerHour * 0.6)
      )
      .slice(0, 5);

    return {
      extensionOpportunities,
      missingDaysImpact,
      underperformingSlots,
      platformGaps,
      topPerformers,
      needsAttention
    };
  }, [restaurantStats, networkAvgRevenuePerHour, networkAvgHours]);

  const hasInsights = insights.extensionOpportunities.length > 0 || 
    insights.missingDaysImpact.length > 0 ||
    insights.platformGaps.length > 0 ||
    insights.needsAttention.length > 0;

  if (!hasInsights) {
    return (
      <Card className="backdrop-blur-xl bg-muted/30 border-border/50">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Pas assez de données pour générer des recommandations</p>
          <p className="text-sm">Importez des données de revenus pour débloquer les analyses</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      {/* Section Jours manquants */}
      {insights.missingDaysImpact.length > 0 && (
        <Card className="backdrop-blur-xl bg-gradient-to-br from-amber-500/5 to-orange-500/10 border-amber-500/30 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Calendar className="h-5 w-5" />
              Jours non couverts = Revenus perdus
              <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                ~{insights.missingDaysImpact.reduce((sum, r) => sum + r.estimatedLostRevenue, 0).toLocaleString()}€/mois estimé
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {insights.missingDaysImpact.slice(0, 4).map(r => (
                <div 
                  key={r.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-amber-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{r.name}</p>
                      <div className="flex gap-1 mt-1">
                        {r.missingDays.map(day => (
                          <Badge 
                            key={day} 
                            variant="outline" 
                            className="text-xs bg-amber-500/10 border-amber-500/30"
                          >
                            {DAY_LABELS[day]}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground ml-1">non couvert</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-600">
                      ~{r.estimatedLostRevenue.toLocaleString()}€/mois
                    </p>
                    <p className="text-xs text-muted-foreground">
                      manque à gagner estimé
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Écarts Uber/Deliveroo */}
      {insights.platformGaps.length > 0 && (
        <Card className="backdrop-blur-xl bg-gradient-to-br from-blue-500/5 to-indigo-500/10 border-blue-500/30 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Zap className="h-5 w-5" />
              Écarts horaires entre plateformes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {insights.platformGaps.slice(0, 3).map(r => (
                <div 
                  key={r.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <ArrowRight className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Uber: {r.totalUberHours}h vs Deliveroo: {r.totalDeliverooHours}h
                        <span className="text-blue-600 ml-2">
                          (écart de {r.hoursDiff}h)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">
                      +{r.potentialHarmonizationGain.toLocaleString()}€/mois
                    </p>
                    <p className="text-xs text-muted-foreground">
                      si harmonisation
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Restaurants nécessitant attention */}
      {insights.needsAttention.length > 0 && !insights.extensionOpportunities.length && (
        <Card className="backdrop-blur-xl bg-gradient-to-br from-red-500/5 to-rose-500/10 border-red-500/30 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <TrendingDown className="h-5 w-5" />
              Restaurants à surveiller
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {insights.needsAttention.map(r => (
                <div 
                  key={r.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-red-500/20"
                >
                  <span className="font-medium">{r.name}</span>
                  <div className="flex gap-2">
                    {r.missingDays.length >= 2 && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600">
                        {r.missingDays.length} jours manquants
                      </Badge>
                    )}
                    {r.totalHoursPerWeek < networkAvgHours * 0.7 && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600">
                        Peu d'heures ({r.totalHoursPerWeek}h)
                      </Badge>
                    )}
                    {r.revenuePerHour > 0 && r.revenuePerHour < networkAvgRevenuePerHour * 0.6 && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600">
                        CA/h faible ({r.revenuePerHour}€)
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
