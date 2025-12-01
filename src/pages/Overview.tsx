import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, Clock, TrendingDown, Percent, DollarSign, PauseCircle, Award, Euro } from "lucide-react";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PeriodOption = "7d" | "30d" | "current_month" | "year";

const Overview = () => {
  const [period, setPeriod] = useState<PeriodOption>("7d");
  const [rankingTab, setRankingTab] = useState<"rating" | "revenue" | "profitability">("rating");
  const navigate = useNavigate();

  // Calculate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "current_month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
    
    return { startDate, endDate: now };
  };

  const { startDate, endDate } = getDateRange();

  // Fetch network health data
  const { data: networkData, isLoading, error } = useQuery({
    queryKey: ["network-health", period],
    queryFn: async () => {
      console.log("Fetching network health data...");
      
      // Fetch all active restaurants with their data
      const { data: restaurants, error: restaurantsError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("is_active", true);
      
      if (restaurantsError) {
        console.error("Error fetching restaurants:", restaurantsError);
        throw restaurantsError;
      }

      console.log("Total restaurants:", restaurants?.length);

      // Fetch monthly fees for profitability calculation
      const { data: feesData, error: feesError } = await supabase
        .from("monthly_fees")
        .select("restaurant_id, platform, net_payout, uber_fee, marketing_fee, offers_cost, ads_cost, error_adjustments, eco_contribution")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (feesError) {
        console.error("Error fetching fees:", feesError);
      }

      // Fetch monthly revenue for profitability calculation
      const { data: revenueData, error: revenueError } = await supabase
        .from("monthly_revenue")
        .select("restaurant_id, platform, revenue_ttc, order_count")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (revenueError) {
        console.error("Error fetching revenue:", revenueError);
      }

      // Calculate restaurant performance metrics
      const restaurantMetrics = restaurants?.map(resto => {
        // Calculate profitability and revenue from fees and revenue
        const restoFees = feesData?.filter(f => f.restaurant_id === resto.id) || [];
        const restoRevenue = revenueData?.filter(r => r.restaurant_id === resto.id) || [];
        
        const totalPayout = restoFees.reduce((sum, f) => sum + (Number(f.net_payout) || 0), 0);
        const totalRevenue = restoRevenue.reduce((sum, r) => sum + (Number(r.revenue_ttc) || 0), 0);
        
        // Use real profitability if available, otherwise generate mock data around 45-47%
        const profitability = totalRevenue > 0 ? (totalPayout / totalRevenue) * 100 : 45 + Math.random() * 2;

        // Mock data for metrics not yet available in DB
        const rating = 3.5 + Math.random() * 1.3; // Random between 3.5 and 4.8
        // Use real revenue if available, otherwise generate mock data
        const revenue = totalRevenue > 0 ? totalRevenue : 50000 + Math.random() * 150000;
        
        return {
          id: resto.id,
          name: resto.name,
          city: resto.city,
          rating: parseFloat(rating.toFixed(1)),
          profitability: parseFloat(profitability.toFixed(1)),
          revenue: parseFloat(revenue.toFixed(0)),
        };
      }) || [];

      // Sort and get top/flop by different metrics
      const sortedByRating = [...restaurantMetrics].sort((a, b) => b.rating - a.rating);
      const topByRating = sortedByRating.slice(0, 5);
      const flopByRating = sortedByRating.slice(-5).reverse();

      const sortedByRevenue = [...restaurantMetrics].sort((a, b) => b.revenue - a.revenue);
      const topByRevenue = sortedByRevenue.slice(0, 5);
      const flopByRevenue = sortedByRevenue.slice(-5).reverse();

      const sortedByProfitability = [...restaurantMetrics].sort((a, b) => b.profitability - a.profitability);
      const topByProfitability = sortedByProfitability.slice(0, 5);
      const flopByProfitability = sortedByProfitability.slice(-5).reverse();

      // Calculate network-wide averages
      const avgRating = restaurantMetrics.reduce((sum, r) => sum + r.rating, 0) / (restaurantMetrics.length || 1);
      const avgProfitability = restaurantMetrics.reduce((sum, r) => sum + r.profitability, 0) / (restaurantMetrics.length || 1);

      // Calculate platform-specific metrics
      const uberFees = feesData?.filter(f => f.platform === "uber_eats") || [];
      const deliverooFees = feesData?.filter(f => f.platform === "deliveroo") || [];
      const uberRevenue = revenueData?.filter(r => r.platform === "uber_eats") || [];
      const deliverooRevenue = revenueData?.filter(r => r.platform === "deliveroo") || [];

      const uberTotalPayout = uberFees.reduce((sum, f) => sum + (Number(f.net_payout) || 0), 0);
      const uberTotalRevenue = uberRevenue.reduce((sum, r) => sum + (Number(r.revenue_ttc) || 0), 0);
      const uberProfitability = uberTotalRevenue > 0 ? (uberTotalPayout / uberTotalRevenue) * 100 : 0;

      const deliverooTotalPayout = deliverooFees.reduce((sum, f) => sum + (Number(f.net_payout) || 0), 0);
      const deliverooTotalRevenue = deliverooRevenue.reduce((sum, r) => sum + (Number(r.revenue_ttc) || 0), 0);
      const deliverooProfitability = deliverooTotalRevenue > 0 ? (deliverooTotalPayout / deliverooTotalRevenue) * 100 : 0;

      // Return combined real + mock data
      const result = {
        global: {
          rating: parseFloat(avgRating.toFixed(1)),
          prepTime: 18, // Mock - will come from delivery_stats
          errorRate: 2.3, // Mock - will come from order_errors
          incorrectOrderRate: 1.8, // Mock - will come from order_errors
          profitability: parseFloat(avgProfitability.toFixed(1)),
          downtime: 45, // Mock - will come from downtime_logs
          productRating: 4.5, // Mock - will come from menu_item_reviews
        },
        uber: {
          rating: parseFloat((avgRating + 0.1).toFixed(1)), // Mock adjustment
          prepTime: 17, // Mock
          errorRate: 2.1, // Mock
          incorrectOrderRate: 1.6, // Mock
          profitability: parseFloat(uberProfitability.toFixed(1)),
          downtime: 38, // Mock
        },
        deliveroo: {
          rating: parseFloat((avgRating - 0.1).toFixed(1)), // Mock adjustment
          prepTime: 19, // Mock
          errorRate: 2.5, // Mock
          incorrectOrderRate: 2.0, // Mock
          profitability: parseFloat(deliverooProfitability.toFixed(1)),
          downtime: 52, // Mock
        },
        topByRating,
        flopByRating,
        topByRevenue,
        flopByRevenue,
        topByProfitability,
        flopByProfitability,
        topProducts: [
          { name: "Menu Burger", rating: 4.9, reviews: 156 },
          { name: "Pizza Margherita", rating: 4.8, reviews: 203 },
          { name: "Salade César", rating: 4.7, reviews: 98 },
        ],
        improvementProducts: [
          { name: "Menu Végétarien", rating: 3.2, reviews: 45 },
          { name: "Dessert Tiramisu", rating: 3.4, reviews: 67 },
          { name: "Wrap Poulet", rating: 3.5, reviews: 89 },
        ],
        totalRestaurants: restaurants?.length || 0,
      };

      console.log("Returning data:", result);
      return result;
    },
  });

  console.log("Query state - isLoading:", isLoading, "error:", error, "data:", networkData);

  const getPeriodLabel = () => {
    switch (period) {
      case "7d": return "7 derniers jours";
      case "30d": return "30 derniers jours";
      case "current_month": return "Mois en cours";
      case "year": return "Année en cours";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-8 space-y-8">
      {/* Header with glassmorphism */}
      <div className="flex items-center justify-between backdrop-blur-xl bg-card/50 border border-border/50 rounded-2xl p-6 shadow-lg">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Vue d'ensemble
          </h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
              Santé du réseau
            </span>
            <span className="text-sm">·</span>
            <span className="font-semibold">{networkData?.totalRestaurants || 0}</span>
            <span>restaurants actifs</span>
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-[240px] h-12 border-2 bg-background/50 backdrop-blur">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 derniers jours</SelectItem>
            <SelectItem value="30d">30 derniers jours</SelectItem>
            <SelectItem value="current_month">Mois en cours</SelectItem>
            <SelectItem value="year">Année en cours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-pulse">Chargement des données...</div>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Erreur lors du chargement des données: {String(error)}
        </div>
      ) : (
        <>
          {/* KPIs Globaux - Priority Section with Modern Design */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Global Card */}
            <Card className="border-2 border-primary/30 shadow-2xl bg-gradient-to-br from-card via-card to-primary/5 backdrop-blur-xl hover:shadow-primary/20 transition-all duration-500 hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Global</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Toutes plateformes</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.global.rating.toFixed(1)} unit="/5" color="text-blue-500" />
                <MetricRow icon={Clock} label="Temps préparation" value={networkData?.global.prepTime} unit="min" color="text-amber-500" />
                <MetricRow icon={TrendingDown} label="Taux d'erreur" value={networkData?.global.errorRate.toFixed(1)} unit="%" color="text-red-500" />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.global.incorrectOrderRate.toFixed(1)} unit="%" color="text-red-400" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.global.profitability.toFixed(1)} unit="%" color="text-emerald-500" />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={networkData?.global.downtime} unit="min" color="text-orange-500" />
                <MetricRow icon={Star} label="Avis produits" value={networkData?.global.productRating.toFixed(1)} unit="/5" color="text-violet-500" />
              </CardContent>
            </Card>

            {/* Uber Eats Card */}
            <Card className="border-2 border-uber/30 shadow-2xl bg-gradient-to-br from-card via-card to-uber/5 backdrop-blur-xl hover:shadow-uber/20 transition-all duration-500 hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-uber/10 flex items-center justify-center">
                      <UberEatsLogo size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Uber Eats</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{getPeriodLabel()}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.uber.rating.toFixed(1)} unit="/5" color="text-blue-500" />
                <MetricRow icon={Clock} label="Temps préparation" value={networkData?.uber.prepTime} unit="min" color="text-amber-500" />
                <MetricRow icon={TrendingDown} label="Taux d'erreur" value={networkData?.uber.errorRate.toFixed(1)} unit="%" color="text-red-500" />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.uber.incorrectOrderRate.toFixed(1)} unit="%" color="text-red-400" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.uber.profitability.toFixed(1)} unit="%" color="text-emerald-500" />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={networkData?.uber.downtime} unit="min" color="text-orange-500" />
              </CardContent>
            </Card>

            {/* Deliveroo Card */}
            <Card className="border-2 border-deliveroo/30 shadow-2xl bg-gradient-to-br from-card via-card to-deliveroo/5 backdrop-blur-xl hover:shadow-deliveroo/20 transition-all duration-500 hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-deliveroo/10 flex items-center justify-center">
                      <DeliverooLogo size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Deliveroo</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{getPeriodLabel()}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.deliveroo.rating.toFixed(1)} unit="/5" color="text-blue-500" />
                <MetricRow icon={Clock} label="Temps préparation" value={networkData?.deliveroo.prepTime} unit="min" color="text-amber-500" />
                <MetricRow icon={TrendingDown} label="Taux d'erreur" value={networkData?.deliveroo.errorRate.toFixed(1)} unit="%" color="text-red-500" />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.deliveroo.incorrectOrderRate.toFixed(1)} unit="%" color="text-red-400" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.deliveroo.profitability.toFixed(1)} unit="%" color="text-emerald-500" />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={networkData?.deliveroo.downtime} unit="min" color="text-orange-500" />
              </CardContent>
            </Card>
          </div>

          {/* Top & Flop Restaurants with Modern Tabs */}
          <Tabs value={rankingTab} onValueChange={(v) => setRankingTab(v as typeof rankingTab)} className="w-full">
            <div className="flex items-center justify-center mb-8">
              <TabsList className="grid w-full max-w-xl grid-cols-3 h-14 p-1.5 bg-muted/50 backdrop-blur-xl border-2 border-border/50 rounded-2xl shadow-lg">
                <TabsTrigger value="rating" className="flex items-center gap-2.5 text-base font-semibold rounded-xl data-[state=active]:shadow-lg transition-all duration-300">
                  <Star className="h-5 w-5" />
                  Note
                </TabsTrigger>
                <TabsTrigger value="revenue" className="flex items-center gap-2.5 text-base font-semibold rounded-xl data-[state=active]:shadow-lg transition-all duration-300">
                  <Euro className="h-5 w-5" />
                  CA
                </TabsTrigger>
                <TabsTrigger value="profitability" className="flex items-center gap-2.5 text-base font-semibold rounded-xl data-[state=active]:shadow-lg transition-all duration-300">
                  <Percent className="h-5 w-5" />
                  Rentabilité
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="rating" className="mt-0 space-y-0">
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Top 5 by Rating */}
                <Card className="border-2 border-emerald-500/20 shadow-xl bg-gradient-to-br from-card to-emerald-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Award className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Top 5 Restaurants</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.topByRating.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-emerald-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-emerald-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-2 font-bold text-lg">
                                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                {resto.rating}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Flop 5 by Rating */}
                <Card className="border-2 border-red-500/20 shadow-xl bg-gradient-to-br from-card to-red-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-red-600 dark:text-red-400">
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <TrendingDown className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Points d'attention</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.flopByRating.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-red-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-red-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-2 font-bold text-lg text-red-600">
                                <Star className="h-4 w-4 fill-red-400/50 text-red-400/50" />
                                {resto.rating}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="revenue" className="mt-0 space-y-0">
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Top 5 by Revenue */}
                <Card className="border-2 border-emerald-500/20 shadow-xl bg-gradient-to-br from-card to-emerald-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Award className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Top 5 Restaurants</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">CA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.topByRevenue.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-emerald-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-emerald-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-2 font-bold text-lg text-emerald-600 dark:text-emerald-400">
                                {resto.revenue.toLocaleString('fr-FR')} €
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Flop 5 by Revenue */}
                <Card className="border-2 border-red-500/20 shadow-xl bg-gradient-to-br from-card to-red-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-red-600 dark:text-red-400">
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <TrendingDown className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Points d'attention</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">CA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.flopByRevenue.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-red-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-red-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-2 font-bold text-lg text-red-600">
                                {resto.revenue.toLocaleString('fr-FR')} €
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="profitability" className="mt-0 space-y-0">
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Top 5 by Profitability */}
                <Card className="border-2 border-emerald-500/20 shadow-xl bg-gradient-to-br from-card to-emerald-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Award className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Top 5 Restaurants</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Rentabilité</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.topByProfitability.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-emerald-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-emerald-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn("font-bold text-lg", resto.profitability > 55 ? "text-emerald-600 dark:text-emerald-400" : resto.profitability > 45 ? "text-amber-600 dark:text-amber-400" : "text-red-600")}>
                                {resto.profitability}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Flop 5 by Profitability */}
                <Card className="border-2 border-red-500/20 shadow-xl bg-gradient-to-br from-card to-red-500/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="flex items-center gap-3 text-red-600 dark:text-red-400">
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <TrendingDown className="h-6 w-6" />
                      </div>
                      <span className="text-xl">Points d'attention</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="w-16 text-xs font-semibold uppercase">#</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Restaurant</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Ville</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase">Rentabilité</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networkData?.flopByProfitability.map((resto, idx) => (
                          <TableRow 
                            key={resto.id} 
                            className="cursor-pointer hover:bg-red-500/5 transition-all duration-300 border-border/30 group"
                            onClick={() => navigate(`/restaurants/${resto.id}`)}
                          >
                            <TableCell className="font-bold">
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-base h-8 w-8 flex items-center justify-center rounded-lg">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold group-hover:text-red-600 transition-colors">{resto.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{resto.city || "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-bold text-lg text-red-600">
                                {resto.profitability}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Avis Produits */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-warning" />
                  Produits les mieux notés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Note</TableHead>
                      <TableHead className="text-right">Avis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networkData?.topProducts.map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1 text-warning font-semibold">
                            <Star className="h-3 w-3 fill-warning" />
                            {product.rating}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{product.reviews}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Products to Improve */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-warning" />
                  Produits à améliorer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Note</TableHead>
                      <TableHead className="text-right">Avis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networkData?.improvementProducts.map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1 text-warning/70 font-semibold">
                            <Star className="h-3 w-3 fill-warning/70" />
                            {product.rating}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{product.reviews}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

const MetricRow = ({ 
  icon: Icon, 
  label, 
  value, 
  unit, 
  color 
}: { 
  icon: any; 
  label: string; 
  value: any; 
  unit: string; 
  color: string;
}) => (
  <div className="flex items-center justify-between text-sm">
    <span className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4" />
      {label}
    </span>
    <span className={cn("font-semibold", color)}>
      {value}{unit}
    </span>
  </div>
);

export default Overview;
