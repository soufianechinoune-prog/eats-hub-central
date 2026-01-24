import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Clock, Calendar, Award, AlertTriangle, Euro } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { OpeningHoursInsights } from "@/components/compare/OpeningHoursInsights";
import { HourlyOpportunitiesAnalysis } from "@/components/compare/HourlyOpportunitiesAnalysis";
import { ProductsByTimeSlotAnalysis } from "@/components/compare/ProductsByTimeSlotAnalysis";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import { extractCityName } from "@/lib/restaurantUtils";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const OpeningHoursComparison = () => {
  const navigate = useNavigate();
  
  // Use global analytics context
  const {
    visibleRestaurants,
    selectedPlatform,
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange,
  } = useAnalyticsContext();

  // Calculate date range using the shared hook
  const { startDate: startDateObj, endDate: endDateObj } = useDataGranularity({
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange,
  });

  const startDate = format(startDateObj, "yyyy-MM-dd");
  const endDate = format(endDateObj, "yyyy-MM-dd");

  // Fetch restaurants data for visible IDs
  const { data: restaurants, isLoading: loadingRestaurants } = useQuery({
    queryKey: ["restaurants-by-ids", visibleRestaurants],
    queryFn: async () => {
      if (!visibleRestaurants.length) return [];
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .in("id", visibleRestaurants)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: visibleRestaurants.length > 0,
  });

  // Fetch all opening hours for selected restaurants
  const { data: openingHoursData, isPending: pendingHours, isFetching: fetchingHours } = useQuery({
    queryKey: ["opening-hours-comparison", visibleRestaurants, selectedPlatform],
    queryFn: async () => {
      if (!visibleRestaurants.length) return [];
      
      let query = supabase
        .from("restaurant_opening_hours")
        .select("restaurant_id, platform, day_of_week, start_time, end_time, is_overnight")
        .in("restaurant_id", visibleRestaurants);
      
      // Filter by platform if not global
      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: visibleRestaurants.length > 0,
  });

  // Fetch revenue data from daily_sales_uber
  const { data: revenueData, isPending: pendingRevenue, isFetching: fetchingRevenue } = useQuery({
    queryKey: ["opening-hours-revenue-daily", visibleRestaurants, startDate, endDate, selectedPlatform],
    queryFn: async () => {
      if (!visibleRestaurants.length) return [];
      
      let query = supabase
        .from("daily_sales_uber_deduped")
        .select("restaurant_id, revenue_ttc, order_count, date")
        .in("restaurant_id", visibleRestaurants)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Aggregate by restaurant
      const aggregated = (data || []).reduce((acc, row) => {
        if (!acc[row.restaurant_id]) {
          acc[row.restaurant_id] = { revenue_ttc: 0, order_count: 0 };
        }
        acc[row.restaurant_id].revenue_ttc += row.revenue_ttc || 0;
        acc[row.restaurant_id].order_count += row.order_count || 0;
        return acc;
      }, {} as Record<string, { revenue_ttc: number; order_count: number }>);
      
      return Object.entries(aggregated).map(([restaurant_id, stats]) => ({
        restaurant_id,
        revenue_ttc: stats.revenue_ttc,
        order_count: stats.order_count
      }));
    },
    enabled: visibleRestaurants.length > 0,
  });

  // Process data for each restaurant
  const restaurantStats = useMemo(() => {
    if (!openingHoursData?.length || !restaurants?.length) return [];
    
    const stats = restaurants.map(restaurant => {
      const restaurantHours = openingHoursData.filter(h => h.restaurant_id === restaurant.id);
      const restaurantRevenue = revenueData?.find(r => r.restaurant_id === restaurant.id);
      
      // Calculate total hours per platform
      const calculateHours = (slots: typeof restaurantHours) => {
        return slots.reduce((total, slot) => {
          const [startH, startM] = slot.start_time.split(':').map(Number);
          const [endH, endM] = slot.end_time.split(':').map(Number);
          let hours = (endH + endM/60) - (startH + startM/60);
          if (slot.is_overnight || hours < 0) {
            hours = 24 - (startH + startM/60) + (endH + endM/60);
          }
          return total + hours;
        }, 0);
      };
      
      const uberHours = restaurantHours.filter(h => h.platform === "uber_eats");
      const deliverooHours = restaurantHours.filter(h => h.platform === "deliveroo");
      
      const totalUberHours = calculateHours(uberHours);
      const totalDeliverooHours = calculateHours(deliverooHours);
      const totalHoursPerWeek = Math.max(totalUberHours, totalDeliverooHours);
      
      // Days covered
      const uberDays = new Set(uberHours.map(h => h.day_of_week));
      const deliverooDays = new Set(deliverooHours.map(h => h.day_of_week));
      const allDays = new Set([...uberDays, ...deliverooDays]);
      const missingDays = [0, 1, 2, 3, 4, 5, 6].filter(day => !allDays.has(day));
      
      // Revenue calculations
      const totalRevenue = restaurantRevenue?.revenue_ttc || 0;
      const totalOrders = restaurantRevenue?.order_count || 0;
      const hoursPerMonth = totalHoursPerWeek * 4.3;
      const revenuePerHour = hoursPerMonth > 0 ? totalRevenue / hoursPerMonth : 0;
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        totalHoursPerWeek: Math.round(totalHoursPerWeek * 10) / 10,
        totalUberHours: Math.round(totalUberHours * 10) / 10,
        totalDeliverooHours: Math.round(totalDeliverooHours * 10) / 10,
        daysCovered: allDays.size,
        missingDays,
        totalRevenue,
        totalOrders,
        revenuePerHour: Math.round(revenuePerHour),
        uberDays: Array.from(uberDays),
        deliverooDays: Array.from(deliverooDays),
      };
    });
    
    return stats.sort((a, b) => b.totalHoursPerWeek - a.totalHoursPerWeek);
  }, [openingHoursData, restaurants, revenueData]);

  // Global KPIs
  const globalStats = useMemo(() => {
    if (!restaurantStats.length) return { avgHours: 0, avgRevenuePerHour: 0, totalRestaurants: 0, totalRevenue: 0 };
    
    const avgHours = restaurantStats.reduce((sum, r) => sum + r.totalHoursPerWeek, 0) / restaurantStats.length;
    const restaurantsWithRevenue = restaurantStats.filter(r => r.revenuePerHour > 0);
    const avgRevenuePerHour = restaurantsWithRevenue.length > 0 
      ? restaurantsWithRevenue.reduce((sum, r) => sum + r.revenuePerHour, 0) / restaurantsWithRevenue.length
      : 0;
    const totalRevenue = restaurantStats.reduce((sum, r) => sum + r.totalRevenue, 0);
    
    return {
      avgHours: Math.round(avgHours * 10) / 10,
      avgRevenuePerHour: Math.round(avgRevenuePerHour),
      totalRestaurants: restaurantStats.length,
      totalRevenue,
    };
  }, [restaurantStats]);

  // Heatmap data - days coverage per restaurant
  const heatmapData = useMemo(() => {
    return restaurantStats.map(r => ({
      name: r.name,
      days: [0, 1, 2, 3, 4, 5, 6].map(day => ({
        day,
        label: DAY_LABELS[day],
        uber: r.uberDays.includes(day),
        deliveroo: r.deliverooDays.includes(day),
        covered: r.uberDays.includes(day) || r.deliverooDays.includes(day),
      })),
    }));
  }, [restaurantStats]);

  // Restaurant names for display in child components
  const restaurantNames = useMemo(() => 
    (restaurants || []).map(r => extractCityName(r.name)),
    [restaurants]
  );

  // Debug logs
  useEffect(() => {
    console.debug("[OpeningHoursComparison] Query states:", {
      period: { startDate, endDate, mode: periodMode },
      visibleRestaurants: visibleRestaurants.length,
      restaurants: restaurants?.length ?? 0,
      openingHours: openingHoursData?.length ?? 0,
      revenue: revenueData?.length ?? 0,
      restaurantStats: restaurantStats.length,
    });
  }, [
    startDate,
    endDate,
    periodMode,
    visibleRestaurants.length,
    restaurants?.length,
    openingHoursData?.length,
    revenueData?.length,
    restaurantStats.length,
  ]);

  // Loading state
  const isLoading =
    loadingRestaurants || (visibleRestaurants.length > 0 && (pendingHours || pendingRevenue));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold">Analyse des Horaires</h1>
          <p className="text-muted-foreground text-sm">
            Optimisation des horaires d'ouverture et revenus par créneau
          </p>
        </div>

        {/* Global filters header */}
        <AnalyticsHeader />

        {visibleRestaurants.length === 0 ? (
          <Card className="backdrop-blur-xl bg-muted/30 border-border/50">
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Sélectionnez au moins un restaurant pour voir l'analyse</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global KPIs */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardContent className="pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Heures moyennes / semaine</p>
                    <p className="text-3xl font-bold flex items-center gap-2">
                      <Clock className="h-6 w-6 text-primary" />
                      {globalStats.avgHours}h
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardContent className="pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground">CA moyen / heure</p>
                    <p className="text-3xl font-bold flex items-center gap-2">
                      <Euro className="h-6 w-6 text-primary" />
                      {globalStats.avgRevenuePerHour}€
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {globalStats.avgRevenuePerHour >= 30 ? "✅ Excellent" : globalStats.avgRevenuePerHour >= 15 ? "⚡ Correct" : globalStats.avgRevenuePerHour > 0 ? "⚠️ À optimiser" : "Données manquantes"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-uber/30 shadow-lg">
                <CardContent className="pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <UberEatsLogo size={16} /> Restaurants Uber
                    </p>
                    <p className="text-3xl font-bold">
                      {restaurantStats.filter(r => r.totalUberHours > 0).length}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-deliveroo/30 shadow-lg">
                <CardContent className="pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <DeliverooLogo size={16} /> Restaurants Deliveroo
                    </p>
                    <p className="text-3xl font-bold">
                      {restaurantStats.filter(r => r.totalDeliverooHours > 0).length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Analyse des opportunités horaires */}
            <HourlyOpportunitiesAnalysis
              restaurants={restaurants || []}
              startDate={startDate}
              endDate={endDate}
              restaurantNames={restaurantNames}
            />

            {/* Croisement Produits × Créneaux horaires */}
            <ProductsByTimeSlotAnalysis
              restaurantIds={visibleRestaurants}
              startDate={startDate}
              endDate={endDate}
              restaurantNames={restaurantNames}
            />

            {/* Section Insights intelligents */}
            <OpeningHoursInsights 
              restaurantStats={restaurantStats}
              networkAvgRevenuePerHour={globalStats.avgRevenuePerHour}
              networkAvgHours={globalStats.avgHours}
            />

            {/* Ranking + Heatmap */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Ranking */}
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Classement par heures d'ouverture
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="w-12 text-xs font-semibold uppercase">#</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase">Heures/sem</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase">CA/h</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {restaurantStats.map((resto, idx) => (
                        <TableRow 
                          key={resto.id} 
                          className="cursor-pointer hover:bg-muted/50 transition-all duration-300 border-border/30 group"
                          onClick={() => navigate(`/restaurants/${resto.id}`)}
                        >
                          <TableCell className="font-bold">
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-base h-8 w-8 flex items-center justify-center rounded-lg",
                                idx === 0 && "bg-amber-500/20 text-amber-600 border-amber-500/30",
                                idx === 1 && "bg-slate-400/20 text-slate-600 border-slate-400/30",
                                idx === 2 && "bg-orange-600/20 text-orange-600 border-orange-600/30",
                                idx > 2 && "bg-muted text-muted-foreground"
                              )}
                            >
                              {idx + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold group-hover:text-primary transition-colors">
                            <div>
                              {resto.name}
                              {resto.missingDays.length > 0 && (
                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {resto.missingDays.map(d => DAY_LABELS[d]).join(", ")} non couvert
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-2 font-bold text-lg">
                              <Clock className="h-4 w-4 text-primary" />
                              {resto.totalHoursPerWeek}h
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-medium",
                              resto.revenuePerHour >= 30 ? "text-green-600" :
                              resto.revenuePerHour >= 15 ? "text-amber-600" :
                              resto.revenuePerHour > 0 ? "text-muted-foreground" :
                              "text-muted-foreground/50"
                            )}>
                              {resto.revenuePerHour > 0 ? `${resto.revenuePerHour}€` : "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {restaurantStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Aucune donnée disponible
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Heatmap - Days Coverage */}
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Couverture par jour
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-8 gap-1 text-xs font-medium text-muted-foreground">
                      <div></div>
                      {DAY_LABELS.map(day => (
                        <div key={day} className="text-center">{day}</div>
                      ))}
                    </div>
                    
                    {/* Rows */}
                    {heatmapData.map(row => (
                      <div key={row.name} className="grid grid-cols-8 gap-1 items-center">
                        <div className="text-xs font-medium truncate pr-2" title={row.name}>
                          CS {extractCityName(row.name)}
                        </div>
                        {row.days.map(cell => (
                          <div
                            key={cell.day}
                            className={cn(
                              "h-8 rounded flex items-center justify-center text-xs",
                              cell.uber && cell.deliveroo && "bg-green-500/30 text-green-700 dark:text-green-400",
                              cell.uber && !cell.deliveroo && "bg-uber/30 text-uber",
                              !cell.uber && cell.deliveroo && "bg-deliveroo/30 text-deliveroo",
                              !cell.covered && "bg-muted/50 text-muted-foreground"
                            )}
                            title={
                              cell.uber && cell.deliveroo ? "Uber + Deliveroo" :
                              cell.uber ? "Uber Eats uniquement" :
                              cell.deliveroo ? "Deliveroo uniquement" :
                              "Non couvert"
                            }
                          >
                            {cell.uber && cell.deliveroo ? "✓✓" : cell.covered ? "✓" : "—"}
                          </div>
                        ))}
                      </div>
                    ))}
                    
                    {/* Legend */}
                    <div className="flex items-center gap-4 pt-4 text-xs text-muted-foreground border-t mt-4">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-green-500/30"></div>
                        <span>Uber + Deliveroo</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-uber/30"></div>
                        <span>Uber seul</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-deliveroo/30"></div>
                        <span>Deliveroo seul</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-muted/50"></div>
                        <span>Non couvert</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpeningHoursComparison;
