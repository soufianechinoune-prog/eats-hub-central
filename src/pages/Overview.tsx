import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Clock, TrendingDown, Percent, DollarSign, PauseCircle, Award } from "lucide-react";
import { UberEatsLogo, DeliverooLogo } from "@/components/icons/PlatformIcons";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PeriodOption = "7d" | "30d" | "current_month" | "year";

const Overview = () => {
  const [period, setPeriod] = useState<PeriodOption>("7d");
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
        // Calculate profitability from fees and revenue
        const restoFees = feesData?.filter(f => f.restaurant_id === resto.id) || [];
        const restoRevenue = revenueData?.filter(r => r.restaurant_id === resto.id) || [];
        
        const totalPayout = restoFees.reduce((sum, f) => sum + (Number(f.net_payout) || 0), 0);
        const totalRevenue = restoRevenue.reduce((sum, r) => sum + (Number(r.revenue_ttc) || 0), 0);
        
        const profitability = totalRevenue > 0 ? (totalPayout / totalRevenue) * 100 : 0;

        // Mock data for metrics not yet available in DB
        const rating = 3.5 + Math.random() * 1.3; // Random between 3.5 and 4.8
        
        return {
          id: resto.id,
          name: resto.name,
          city: resto.city,
          rating: parseFloat(rating.toFixed(1)),
          profitability: parseFloat(profitability.toFixed(1)),
        };
      }) || [];

      // Sort and get top/flop
      const sortedByRating = [...restaurantMetrics].sort((a, b) => b.rating - a.rating);
      const topRestaurants = sortedByRating.slice(0, 3);
      const flopRestaurants = sortedByRating.slice(-3).reverse();

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
        topRestaurants,
        flopRestaurants,
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
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vue d'ensemble</h1>
          <p className="text-muted-foreground mt-1">Santé du réseau · {networkData?.totalRestaurants || 0} restaurants actifs</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-[200px]">
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
          {/* KPIs Globaux - Priority Section */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Global Card */}
            <Card className="border-2 border-primary/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Award className="h-5 w-5 text-primary" />
                  Global
                </CardTitle>
                <p className="text-xs text-muted-foreground">Toutes plateformes confondues</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.global.rating.toFixed(1)} unit="/5" color="text-stat-revenue" />
                <MetricRow icon={Clock} label="Temps préparation" value={networkData?.global.prepTime} unit="min" color="text-stat-basket" />
                <MetricRow icon={TrendingDown} label="Taux d'erreur" value={networkData?.global.errorRate.toFixed(1)} unit="%" color="text-destructive" />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.global.incorrectOrderRate.toFixed(1)} unit="%" color="text-destructive" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.global.profitability.toFixed(1)} unit="%" color="text-accent" />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={networkData?.global.downtime} unit="min" color="text-warning" />
                <MetricRow icon={Star} label="Avis produits" value={networkData?.global.productRating.toFixed(1)} unit="/5" color="text-stat-revenue" />
              </CardContent>
            </Card>

            {/* Uber Eats Card */}
            <Card className="border-2 border-uber/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UberEatsLogo size={20} />
                  Uber Eats
                </CardTitle>
                <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.uber.rating.toFixed(1)} unit="/5" color="text-stat-revenue" />
                <MetricRow icon={Clock} label="Temps préparation" value={networkData?.uber.prepTime} unit="min" color="text-stat-basket" />
                <MetricRow icon={TrendingDown} label="Taux d'erreur" value={networkData?.uber.errorRate.toFixed(1)} unit="%" color="text-destructive" />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.uber.incorrectOrderRate.toFixed(1)} unit="%" color="text-destructive" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.uber.profitability.toFixed(1)} unit="%" color="text-accent" />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={networkData?.uber.downtime} unit="min" color="text-warning" />
              </CardContent>
            </Card>

            {/* Deliveroo Card */}
            <Card className="border-2 border-deliveroo/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DeliverooLogo size={20} />
                  Deliveroo
                </CardTitle>
                <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <MetricRow icon={Star} label="Note moyenne" value={networkData?.deliveroo.rating.toFixed(1)} unit="/5" color="text-stat-revenue" />
                <MetricRow icon={Clock} label="Temps préparation" value={networkData?.deliveroo.prepTime} unit="min" color="text-stat-basket" />
                <MetricRow icon={TrendingDown} label="Taux d'erreur" value={networkData?.deliveroo.errorRate.toFixed(1)} unit="%" color="text-destructive" />
                <MetricRow icon={TrendingDown} label="Commandes incorrectes" value={networkData?.deliveroo.incorrectOrderRate.toFixed(1)} unit="%" color="text-destructive" />
                <MetricRow icon={Percent} label="Rentabilité" value={networkData?.deliveroo.profitability.toFixed(1)} unit="%" color="text-accent" />
                <MetricRow icon={PauseCircle} label="Temps inactivité" value={networkData?.deliveroo.downtime} unit="min" color="text-warning" />
              </CardContent>
            </Card>
          </div>

          {/* Top & Flop Restaurants */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top 3 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success">
                  <Award className="h-5 w-5" />
                  Top 3 Restaurants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead className="text-right">Note</TableHead>
                      <TableHead className="text-right">Rentabilité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networkData?.topRestaurants.map((resto, idx) => (
                      <TableRow 
                        key={resto.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/restaurants/${resto.id}`)}
                      >
                        <TableCell className="font-semibold">
                          <Badge variant="secondary" className="bg-accent/10 text-accent">{idx + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{resto.name}</TableCell>
                        <TableCell className="text-muted-foreground">{resto.city || "—"}</TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Star className="h-3 w-3 fill-warning text-warning" />
                            {resto.rating}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn("font-semibold", resto.profitability > 65 ? "text-accent" : "text-warning")}>
                            {resto.profitability}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Flop 3 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <TrendingDown className="h-5 w-5" />
                  À surveiller
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead className="text-right">Note</TableHead>
                      <TableHead className="text-right">Rentabilité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networkData?.flopRestaurants.map((resto, idx) => (
                      <TableRow 
                        key={resto.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/restaurants/${resto.id}`)}
                      >
                        <TableCell className="font-semibold">
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive">{idx + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{resto.name}</TableCell>
                        <TableCell className="text-muted-foreground">{resto.city || "—"}</TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Star className="h-3 w-3 fill-destructive/50 text-destructive/50" />
                            {resto.rating}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-destructive">
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
