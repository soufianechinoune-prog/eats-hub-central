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
  
  const {
    visibleRestaurants,
    selectedPlatform,
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange,
  } = useAnalyticsContext();

  const { startDate: startDateObj, endDate: endDateObj } = useDataGranularity({
    periodMode,
    selectedYear,
    selectedMonth,
    dateRange,
  });

  const startDate = format(startDateObj, "yyyy-MM-dd");
  const endDate = format(endDateObj, "yyyy-MM-dd");

  // Fetch restaurants data
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

  // Fetch active hours summary from orders (new RPC)
  const { data: activeHoursData, isPending: pendingActiveHours } = useQuery({
    queryKey: ["active-hours-summary", visibleRestaurants, startDate, endDate, selectedPlatform],
    queryFn: async () => {
      if (!visibleRestaurants.length) return [];
      const { data, error } = await supabase.rpc("get_active_hours_summary", {
        p_restaurant_ids: visibleRestaurants,
        p_start_date: startDate,
        p_end_date: endDate,
        p_platform: selectedPlatform === "global" ? null : selectedPlatform,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: visibleRestaurants.length > 0,
  });

  // Fetch opening hours (optional, for heatmap only)
  const { data: openingHoursData } = useQuery({
    queryKey: ["opening-hours-comparison", visibleRestaurants, selectedPlatform],
    queryFn: async () => {
      if (!visibleRestaurants.length) return [];
      let query = supabase
        .from("restaurant_opening_hours")
        .select("restaurant_id, platform, day_of_week, start_time, end_time, is_overnight")
        .in("restaurant_id", visibleRestaurants);
      if (selectedPlatform !== "global") {
        query = query.eq("platform", selectedPlatform);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: visibleRestaurants.length > 0,
  });

  // Process data for each restaurant using active hours RPC
  const restaurantStats = useMemo(() => {
    if (!restaurants?.length || !activeHoursData?.length) return [];

    return restaurants
      .map((restaurant) => {
        const activeData = activeHoursData.find((a) => a.restaurant_id === restaurant.id);
        if (!activeData) return null;

        const avgHoursPerWeek = activeData.avg_hours_per_week || 0;
        const totalRevenue = activeData.total_revenue || 0;
        const totalOrders = Number(activeData.total_orders) || 0;
        const distinctHours = Number(activeData.distinct_active_hours) || 0;
        const revenuePerHour = distinctHours > 0 ? Math.round(totalRevenue / distinctHours) : 0;

        // Get opening hours coverage info if available
        const restaurantHours = (openingHoursData || []).filter(
          (h) => h.restaurant_id === restaurant.id
        );
        const uberDays = [...new Set(restaurantHours.filter((h) => h.platform === "uber_eats").map((h) => h.day_of_week))];
        const deliverooDays = [...new Set(restaurantHours.filter((h) => h.platform === "deliveroo").map((h) => h.day_of_week))];
        const allDays = new Set([...uberDays, ...deliverooDays]);
        const missingDays = [0, 1, 2, 3, 4, 5, 6].filter((day) => !allDays.has(day));

        return {
          id: restaurant.id,
          name: restaurant.name,
          totalHoursPerWeek: Number(avgHoursPerWeek),
          totalUberHours: activeData.has_uber ? Number(avgHoursPerWeek) : 0,
          totalDeliverooHours: activeData.has_deliveroo ? Number(avgHoursPerWeek) : 0,
          daysCovered: allDays.size,
          missingDays: restaurantHours.length > 0 ? missingDays : [],
          totalRevenue,
          totalOrders,
          revenuePerHour,
          uberDays,
          deliverooDays,
          hasUber: activeData.has_uber,
          hasDeliveroo: activeData.has_deliveroo,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.totalHoursPerWeek - a!.totalHoursPerWeek) as NonNullable<typeof restaurantStats[number]>[];
  }, [restaurants, activeHoursData, openingHoursData]);

  // Global KPIs
  const globalStats = useMemo(() => {
    if (!restaurantStats.length)
      return { avgHours: 0, avgRevenuePerHour: 0, totalRestaurants: 0, uberCount: 0, deliverooCount: 0 };

    const avgHours =
      restaurantStats.reduce((sum, r) => sum + r.totalHoursPerWeek, 0) / restaurantStats.length;
    const withRevenue = restaurantStats.filter((r) => r.revenuePerHour > 0);
    const avgRevenuePerHour =
      withRevenue.length > 0
        ? withRevenue.reduce((sum, r) => sum + r.revenuePerHour, 0) / withRevenue.length
        : 0;

    return {
      avgHours: Math.round(avgHours * 10) / 10,
      avgRevenuePerHour: Math.round(avgRevenuePerHour),
      totalRestaurants: restaurantStats.length,
      uberCount: restaurantStats.filter((r) => r.hasUber).length,
      deliverooCount: restaurantStats.filter((r) => r.hasDeliveroo).length,
    };
  }, [restaurantStats]);

  // Heatmap data (only if opening hours exist)
  const heatmapData = useMemo(() => {
    if (!openingHoursData?.length) return [];
    return restaurantStats
      .filter((r) => r.uberDays.length > 0 || r.deliverooDays.length > 0)
      .map((r) => ({
        name: r.name,
        days: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          day,
          label: DAY_LABELS[day],
          uber: r.uberDays.includes(day),
          deliveroo: r.deliverooDays.includes(day),
          covered: r.uberDays.includes(day) || r.deliverooDays.includes(day),
        })),
      }));
  }, [restaurantStats, openingHoursData]);

  const restaurantNames = useMemo(
    () => (restaurants || []).map((r) => extractCityName(r.name)),
    [restaurants]
  );

  const isLoading =
    loadingRestaurants || (visibleRestaurants.length > 0 && pendingActiveHours);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analyse des Horaires</h1>
          <p className="text-muted-foreground text-sm">
            Optimisation des horaires d'ouverture et revenus par créneau
          </p>
        </div>

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
                  <p className="text-sm text-muted-foreground">Heures actives moy. / semaine</p>
                  <p className="text-3xl font-bold flex items-center gap-2">
                    <Clock className="h-6 w-6 text-primary" />
                    {globalStats.avgHours}h
                  </p>
                  <p className="text-xs text-muted-foreground">Basé sur les commandes réelles</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">CA moyen / heure active</p>
                  <p className="text-3xl font-bold flex items-center gap-2">
                    <Euro className="h-6 w-6 text-primary" />
                    {globalStats.avgRevenuePerHour}€
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {globalStats.avgRevenuePerHour >= 30
                      ? "✅ Excellent"
                      : globalStats.avgRevenuePerHour >= 15
                      ? "⚡ Correct"
                      : globalStats.avgRevenuePerHour > 0
                      ? "⚠️ À optimiser"
                      : "Données manquantes"}
                  </p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-uber/30 shadow-lg">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <UberEatsLogo size={16} /> Restaurants Uber actifs
                  </p>
                  <p className="text-3xl font-bold">{globalStats.uberCount}</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-card/80 border-deliveroo/30 shadow-lg">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <DeliverooLogo size={16} /> Restaurants Deliveroo actifs
                  </p>
                  <p className="text-3xl font-bold">{globalStats.deliverooCount}</p>
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
            <div className={cn("grid gap-6", heatmapData.length > 0 ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
              {/* Ranking */}
              <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Classement par heures d'activité
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
                                  {resto.missingDays.map((d) => DAY_LABELS[d]).join(", ")} non couvert
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
                            <span
                              className={cn(
                                "font-medium",
                                resto.revenuePerHour >= 30
                                  ? "text-green-600"
                                  : resto.revenuePerHour >= 15
                                  ? "text-amber-600"
                                  : resto.revenuePerHour > 0
                                  ? "text-muted-foreground"
                                  : "text-muted-foreground/50"
                              )}
                            >
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

              {/* Heatmap - Days Coverage (only if manual hours exist) */}
              {heatmapData.length > 0 && (
                <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Couverture par jour
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-8 gap-1 text-xs font-medium text-muted-foreground">
                        <div></div>
                        {DAY_LABELS.map((day) => (
                          <div key={day} className="text-center">
                            {day}
                          </div>
                        ))}
                      </div>

                      {heatmapData.map((row) => (
                        <div key={row.name} className="grid grid-cols-8 gap-1 items-center">
                          <div className="text-xs font-medium truncate pr-2" title={row.name}>
                            CS {extractCityName(row.name)}
                          </div>
                          {row.days.map((cell) => (
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
                                cell.uber && cell.deliveroo
                                  ? "Uber + Deliveroo"
                                  : cell.uber
                                  ? "Uber Eats uniquement"
                                  : cell.deliveroo
                                  ? "Deliveroo uniquement"
                                  : "Non couvert"
                              }
                            >
                              {cell.uber && cell.deliveroo ? "✓✓" : cell.covered ? "✓" : "—"}
                            </div>
                          ))}
                        </div>
                      ))}

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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpeningHoursComparison;
