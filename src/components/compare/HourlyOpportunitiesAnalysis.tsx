import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { 
  Clock, 
  TrendingUp, 
  Target,
  ArrowUpRight,
  Sparkles,
  Eye,
  Loader2,
  ShoppingCart,
  Euro,
  ShoppingBag
} from "lucide-react";
import { useAIAdvisorContext } from "@/contexts/AIAdvisorContext";

type DisplayMode = 'orders' | 'revenue' | 'basket';

interface Restaurant {
  id: string;
  name: string;
}

interface HourlyOpportunitiesAnalysisProps {
  restaurants: Restaurant[];
  startDate: string;
  endDate: string;
}

interface HourlyData {
  restaurant_id: string;
  hour: number;
  order_count: number;
  revenue: number;
}

const HOUR_LABELS: Record<number, string> = {
  11: "11h",
  12: "12h",
  13: "13h",
  14: "14h",
  18: "18h",
  19: "19h",
  20: "20h",
  21: "21h",
  22: "22h",
  23: "23h",
  0: "00h",
  1: "01h",
  2: "02h",
  3: "03h",
};

const TIME_SLOTS = [
  { label: "Déjeuner", hours: [11, 12, 13, 14], color: "text-amber-600", range: "11h-15h" },
  { label: "Après-midi", hours: [15, 16, 17], color: "text-cyan-600", range: "15h-18h" },
  { label: "Dîner", hours: [18, 19, 20, 21], color: "text-blue-600", range: "18h-22h" },
  { label: "Soirée", hours: [22, 23], color: "text-purple-600", range: "22h-00h" },
  { label: "Late-night", hours: [0, 1, 2, 3], color: "text-rose-600", range: "00h-04h" },
];

export const HourlyOpportunitiesAnalysis = ({ 
  restaurants, 
  startDate, 
  endDate 
}: HourlyOpportunitiesAnalysisProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('orders');
  const { openWithMessage } = useAIAdvisorContext();
  
  // Fetch hourly order data using RPC function (avoids 1000 row limit)
  const { data: hourlyData, isLoading } = useQuery({
    queryKey: ["hourly-orders-rpc", restaurants.map(r => r.id), startDate, endDate],
    queryFn: async () => {
      if (!restaurants?.length) return [];
      
      const { data, error } = await supabase
        .rpc("get_hourly_order_performance", {
          p_restaurant_ids: restaurants.map(r => r.id),
          p_start_date: startDate,
          p_end_date: endDate,
        });
      
      if (error) throw error;
      
      // Convert to expected format
      return (data || []).map((row: { restaurant_id: string; hour: number; order_count: number; revenue: number }) => ({
        restaurant_id: row.restaurant_id,
        hour: row.hour,
        order_count: Number(row.order_count),
        revenue: Number(row.revenue),
      })) as HourlyData[];
    },
    enabled: restaurants?.length > 0,
  });

  // Calculate network averages by hour
  const networkAverages = useMemo(() => {
    if (!hourlyData?.length) return {};
    
    const hourTotals: Record<number, { totalOrders: number; totalRevenue: number; restaurantCount: number }> = {};
    
    // Group data by hour across all restaurants
    hourlyData.forEach(d => {
      if (!hourTotals[d.hour]) {
        hourTotals[d.hour] = { totalOrders: 0, totalRevenue: 0, restaurantCount: 0 };
      }
      hourTotals[d.hour].totalOrders += d.order_count;
      hourTotals[d.hour].totalRevenue += d.revenue;
    });
    
    // Count how many restaurants have data for each hour
    const restaurantsByHour: Record<number, Set<string>> = {};
    hourlyData.forEach(d => {
      if (!restaurantsByHour[d.hour]) {
        restaurantsByHour[d.hour] = new Set();
      }
      restaurantsByHour[d.hour].add(d.restaurant_id);
    });
    
    // Calculate averages
    const averages: Record<number, { avgOrders: number; avgRevenue: number; totalOrders: number }> = {};
    Object.entries(hourTotals).forEach(([hour, stats]) => {
      const h = parseInt(hour);
      const count = restaurantsByHour[h]?.size || 1;
      averages[h] = {
        avgOrders: Math.round(stats.totalOrders / count),
        avgRevenue: Math.round(stats.totalRevenue / count),
        totalOrders: stats.totalOrders,
      };
    });
    
    return averages;
  }, [hourlyData]);

  // Calculate extension opportunities based on real hourly data
  const extensionOpportunities = useMemo(() => {
    if (!hourlyData?.length || !restaurants.length) return [];
    
    const opportunities: Array<{
      restaurant: Restaurant;
      currentMaxHour: number;
      networkMaxHour: number;
      potentialHours: number[];
      estimatedOrders: number;
      estimatedRevenue: number;
      referenceRestaurant?: string;
    }> = [];

    // Find the latest hour with significant activity for each restaurant
    restaurants.forEach(restaurant => {
      const restaurantHourlyData = hourlyData.filter(d => d.restaurant_id === restaurant.id);
      if (!restaurantHourlyData.length) return;

      // Find the restaurant's latest active hour
      const activeHours = restaurantHourlyData
        .filter(d => d.order_count >= 3) // At least 3 orders to be considered active
        .map(d => d.hour)
        .sort((a, b) => {
          // Sort with late night hours (0-4) coming after 22-23
          const aAdj = a < 5 ? a + 24 : a;
          const bAdj = b < 5 ? b + 24 : b;
          return bAdj - aAdj;
        });

      if (!activeHours.length) return;

      const latestActiveHour = activeHours[0];
      const latestAdjusted = latestActiveHour < 5 ? latestActiveHour + 24 : latestActiveHour;

      // Find hours where other restaurants have activity but this one doesn't
      const networkActiveHours = Object.entries(networkAverages)
        .filter(([_, stats]) => stats.totalOrders >= 10) // Significant network activity
        .map(([hour]) => parseInt(hour));

      // Find potential extension hours (later than restaurant's latest, but network has activity)
      const potentialHours = networkActiveHours.filter(hour => {
        const hourAdj = hour < 5 ? hour + 24 : hour;
        const hasActivity = restaurantHourlyData.some(d => d.hour === hour && d.order_count >= 3);
        return hourAdj > latestAdjusted && !hasActivity;
      });

      if (potentialHours.length > 0) {
        // Calculate potential gains
        let estimatedOrders = 0;
        let estimatedRevenue = 0;

        potentialHours.forEach(hour => {
          const networkAvg = networkAverages[hour];
          if (networkAvg) {
            // Estimate this restaurant could capture ~60% of network average
            estimatedOrders += Math.round(networkAvg.avgOrders * 0.6);
            estimatedRevenue += Math.round(networkAvg.avgRevenue * 0.6);
          }
        });

        // Find reference restaurant (one that performs well at these hours)
        const referenceRestaurant = restaurants.find(r => {
          if (r.id === restaurant.id) return false;
          const rData = hourlyData.filter(d => d.restaurant_id === r.id);
          return potentialHours.some(h => 
            rData.some(d => d.hour === h && d.order_count >= 5)
          );
        });

        opportunities.push({
          restaurant,
          currentMaxHour: latestActiveHour,
          networkMaxHour: Math.max(...networkActiveHours.map(h => h < 5 ? h + 24 : h)) % 24,
          potentialHours: potentialHours.slice(0, 3), // Top 3 hours
          estimatedOrders,
          estimatedRevenue,
          referenceRestaurant: referenceRestaurant?.name,
        });
      }
    });

    return opportunities
      .filter(o => o.estimatedRevenue > 100) // Only significant opportunities
      .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);
  }, [hourlyData, restaurants, networkAverages]);

  // Restaurant performance by time slot
  const restaurantPerformance = useMemo(() => {
    if (!hourlyData?.length || !restaurants.length) return [];

    return restaurants.map(restaurant => {
      const restaurantData = hourlyData.filter(d => d.restaurant_id === restaurant.id);
      
      const slotPerformance = TIME_SLOTS.map(slot => {
        const slotData = restaurantData.filter(d => slot.hours.includes(d.hour));
        const totalOrders = slotData.reduce((sum, d) => sum + d.order_count, 0);
        const totalRevenue = slotData.reduce((sum, d) => sum + d.revenue, 0);
        const avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        return {
          ...slot,
          orders: totalOrders,
          revenue: totalRevenue,
          avgBasket,
          revenuePercent: 0, // Will be calculated after we have totals
        };
      });

      const totalOrders = slotPerformance.reduce((sum, s) => sum + s.orders, 0);
      const totalRevenue = slotPerformance.reduce((sum, s) => sum + s.revenue, 0);

      // Calculate % of revenue for each slot
      slotPerformance.forEach(slot => {
        slot.revenuePercent = totalRevenue > 0 
          ? Math.round((slot.revenue / totalRevenue) * 100)
          : 0;
      });

      const avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        restaurant,
        slotPerformance,
        totalOrders,
        totalRevenue,
        avgBasket,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [hourlyData, restaurants]);

  if (isLoading) {
    return (
      <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hourlyData?.length) {
    return (
      <Card className="backdrop-blur-xl bg-muted/30 border-border/50">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucune donnée de commandes disponible pour cette période</p>
          <p className="text-sm">Les analyses horaires nécessitent l'historique des commandes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Extension Opportunities - Data-driven */}
      {extensionOpportunities.length > 0 && (
        <Card className="backdrop-blur-xl bg-gradient-to-br from-emerald-500/5 to-green-500/10 border-emerald-500/30 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" />
              Potentiel d'extension horaire
              <Badge variant="outline" className="ml-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                Basé sur les commandes réelles
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {extensionOpportunities.slice(0, 4).map(opp => (
                <div 
                  key={opp.restaurant.id} 
                  className="p-4 rounded-xl bg-background/60 border border-emerald-500/20 hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-bold text-foreground">{opp.restaurant.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          Ferme à {HOUR_LABELS[opp.currentMaxHour] || `${opp.currentMaxHour}h`}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Créneaux à fort potentiel :</span>
                          <div className="flex gap-1">
                            {opp.potentialHours.map(h => (
                              <Badge key={h} className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                {HOUR_LABELS[h] || `${h}h`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        {opp.referenceRestaurant && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Référence : {opp.referenceRestaurant} performe bien sur ces créneaux
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-emerald-600 font-bold text-lg">
                        <ArrowUpRight className="h-4 w-4" />
                        +{opp.estimatedOrders} cmd
                      </div>
                      <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        ~+{opp.estimatedRevenue.toLocaleString()}€
                      </div>
                      <span className="text-xs text-muted-foreground">potentiel/mois</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance by Time Slot */}
      <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Performance par créneau horaire
            </CardTitle>
            <div className="flex items-center gap-3">
              <ToggleGroup 
                type="single" 
                value={displayMode} 
                onValueChange={(v) => v && setDisplayMode(v as DisplayMode)}
                className="bg-muted/50 rounded-lg p-0.5"
              >
                <ToggleGroupItem value="orders" aria-label="Commandes" className="gap-1.5 text-xs px-2.5 py-1 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Cmd
                </ToggleGroupItem>
                <ToggleGroupItem value="revenue" aria-label="Chiffre d'affaires" className="gap-1.5 text-xs px-2.5 py-1 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  <Euro className="h-3.5 w-3.5" />
                  CA
                </ToggleGroupItem>
                <ToggleGroupItem value="basket" aria-label="Panier moyen" className="gap-1.5 text-xs px-2.5 py-1 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Panier
                </ToggleGroupItem>
              </ToggleGroup>
              <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (isAnalyzing || !restaurantPerformance.length) return;
                setIsAnalyzing(true);

                try {
                  console.log('[HourlyOpportunitiesAnalysis] Samir Vision click', {
                    restaurants: restaurants.length,
                    startDate,
                    endDate,
                    performanceRows: restaurantPerformance.length,
                    opportunities: extensionOpportunities.length,
                  });

                  // Build contextualized prompt with performance data
                  const performanceLines = restaurantPerformance
                    .map(({ restaurant, slotPerformance, totalOrders, totalRevenue }) => {
                      const slotDetails = slotPerformance
                        .filter((s) => s.orders > 0)
                        .map(
                          (s) =>
                            `  - ${s.label} (${s.range}) : ${s.orders} cmd (${s.revenuePercent}% CA)${
                              s.revenuePercent >= 30
                                ? ' ← point fort'
                                : s.revenuePercent < 10 && s.orders > 0
                                  ? ' ← opportunité ?'
                                  : ''
                            }`
                        )
                        .join('\n');

                      return `**${restaurant.name}** : ${totalOrders} commandes, ${totalRevenue.toLocaleString()}€\n${slotDetails}`;
                    })
                    .join('\n\n');

                  const opportunitiesLines =
                    extensionOpportunities.length > 0
                      ?
                        "\n\n**Opportunités d'extension détectées :**\n" +
                        extensionOpportunities
                          .map(
                            (opp) =>
                              `- ${opp.restaurant.name} pourrait gagner +${opp.estimatedOrders} cmd (~${opp.estimatedRevenue}€) en restant ouvert jusqu'à ${opp.potentialHours.map((h) => `${h}h`).join(', ')}`
                          )
                          .join('\n')
                      : '';

                  const prompt = `Données horaires ${startDate} au ${endDate} :
${performanceLines}
${opportunitiesLines}

Donne-moi une synthèse en 5 bullet points MAX :
• Le restaurant prioritaire à optimiser et pourquoi
• Le gain potentiel estimé (€/mois)
• L'action concrète à faire cette semaine
• Un insight surprenant dans les données
• La prochaine étape recommandée

Format court et direct, max 150 mots.`;

                  console.log('[HourlyOpportunitiesAnalysis] openWithMessage(prompt)', {
                    promptLen: prompt.length,
                  });

                  openWithMessage(prompt);
                } finally {
                  setIsAnalyzing(false);
                }
              }}
              disabled={isAnalyzing}
              className="gap-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/30 hover:border-violet-500/50 hover:bg-violet-500/20 transition-all"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 text-violet-600" />
              )}
              <span className="text-violet-700 dark:text-violet-400">Samir Vision</span>
              <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 bg-violet-500/20 text-violet-600 border-violet-500/30">
                IA
              </Badge>
            </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                {TIME_SLOTS.map(slot => (
                  <TableHead key={slot.label} className={cn("text-center text-xs font-semibold uppercase", slot.color)}>
                    {slot.label}
                    <div className="text-[10px] font-normal text-muted-foreground">
                      {slot.range}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-right text-xs font-semibold uppercase">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restaurantPerformance.slice(0, 8).map(({ restaurant, slotPerformance, totalOrders, totalRevenue, avgBasket }) => (
                <TableRow key={restaurant.id} className="hover:bg-muted/50 transition-colors border-border/30">
                  <TableCell className="font-medium min-w-[200px]">
                    <span className="block" title={restaurant.name}>
                      {restaurant.name}
                    </span>
                  </TableCell>
                  {slotPerformance.map(slot => {
                    // Check if this slot has an extension opportunity for this restaurant
                    const hasOpportunity = extensionOpportunities.some(
                      opp => opp.restaurant.id === restaurant.id && 
                             slot.hours.some(h => opp.potentialHours.includes(h))
                    );
                    // Check if this is a strong slot
                    const isStrong = slot.revenuePercent >= 30;
                    // Check if under-exploited (has orders but low share)
                    const isUnderExploited = slot.orders > 0 && slot.revenuePercent < 10;
                    
                    // Render content based on display mode
                    const renderContent = () => {
                      switch (displayMode) {
                        case 'orders':
                          return (
                            <>
                              <span className="font-semibold">{slot.orders}</span>
                              <span className={cn(
                                "text-xs",
                                slot.revenuePercent >= 30 ? "text-green-600" :
                                slot.revenuePercent >= 15 ? "text-blue-600" :
                                slot.revenuePercent > 0 ? "text-muted-foreground" :
                                "text-muted-foreground/50"
                              )}>
                                {slot.revenuePercent}% CA
                              </span>
                            </>
                          );
                        case 'revenue':
                          return (
                            <>
                              <span className="font-semibold">{slot.revenue.toLocaleString()}€</span>
                              <span className={cn(
                                "text-xs",
                                slot.revenuePercent >= 30 ? "text-green-600" :
                                slot.revenuePercent >= 15 ? "text-blue-600" :
                                slot.revenuePercent > 0 ? "text-muted-foreground" :
                                "text-muted-foreground/50"
                              )}>
                                {slot.revenuePercent}%
                              </span>
                            </>
                          );
                        case 'basket':
                          return (
                            <>
                              <span className="font-semibold">{slot.avgBasket.toFixed(2)}€</span>
                              <span className="text-xs text-muted-foreground">
                                {slot.orders} cmd
                              </span>
                            </>
                          );
                      }
                    };
                    
                    return (
                      <TableCell key={slot.label} className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {renderContent()}
                          {/* Visual tags for surveillance */}
                          {hasOpportunity && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5 bg-amber-500/10 text-amber-600 border-amber-500/30">
                              À surveiller
                            </Badge>
                          )}
                          {isStrong && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5 bg-green-500/10 text-green-600 border-green-500/30">
                              Point fort
                            </Badge>
                          )}
                          {isUnderExploited && !hasOpportunity && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5 bg-orange-500/10 text-orange-600 border-orange-500/30">
                              Sous-exploité
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">
                    {displayMode === 'orders' && (
                      <>
                        <div className="font-bold">{totalOrders} cmd</div>
                        <div className="text-xs text-muted-foreground">{totalRevenue.toLocaleString()}€</div>
                      </>
                    )}
                    {displayMode === 'revenue' && (
                      <>
                        <div className="font-bold">{totalRevenue.toLocaleString()}€</div>
                        <div className="text-xs text-muted-foreground">{totalOrders} cmd</div>
                      </>
                    )}
                    {displayMode === 'basket' && (
                      <>
                        <div className="font-bold">{avgBasket.toFixed(2)}€</div>
                        <div className="text-xs text-muted-foreground">{totalOrders} cmd</div>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              % CA = part du CA
            </span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-500/10 text-green-600 border-green-500/30">
              Point fort
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
              À surveiller
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-500/10 text-orange-600 border-orange-500/30">
              Sous-exploité
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
