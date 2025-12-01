import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const { data: networkData, isLoading } = useQuery({
    queryKey: ["network-health", period, startDate, endDate],
    queryFn: async () => {
      // Fetch profitability data from monthly_fees
      const { data: feesData } = await supabase
        .from("monthly_fees")
        .select("platform, net_payout")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Fetch restaurants count
      const { count: totalRestaurants } = await supabase
        .from("restaurants")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // For now, return mock data structure that will be filled with real data later
      return {
        global: {
          rating: 4.2,
          prepTime: 18,
          errorRate: 2.3,
          incorrectOrderRate: 1.8,
          profitability: 62.5,
          downtime: 45,
          productRating: 4.5,
        },
        uber: {
          rating: 4.3,
          prepTime: 17,
          errorRate: 2.1,
          incorrectOrderRate: 1.6,
          profitability: 64.2,
          downtime: 38,
        },
        deliveroo: {
          rating: 4.1,
          prepTime: 19,
          errorRate: 2.5,
          incorrectOrderRate: 2.0,
          profitability: 60.8,
          downtime: 52,
        },
        topRestaurants: [
          { id: "1", name: "Restaurant A", city: "Paris", rating: 4.8, profitability: 72.5 },
          { id: "2", name: "Restaurant B", city: "Lyon", rating: 4.7, profitability: 71.2 },
          { id: "3", name: "Restaurant C", city: "Marseille", rating: 4.6, profitability: 70.8 },
        ],
        flopRestaurants: [
          { id: "4", name: "Restaurant D", city: "Nice", rating: 3.2, profitability: 48.5 },
          { id: "5", name: "Restaurant E", city: "Toulouse", rating: 3.4, profitability: 50.2 },
          { id: "6", name: "Restaurant F", city: "Bordeaux", rating: 3.5, profitability: 51.8 },
        ],
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
        totalRestaurants,
      };
    },
  });

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
        <div className="text-center py-12">Chargement des données...</div>
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
                      <TableRow key={resto.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-semibold">
                          <Badge variant="secondary" className="bg-accent/10 text-accent">{idx + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{resto.name}</TableCell>
                        <TableCell className="text-muted-foreground">{resto.city}</TableCell>
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
                      <TableRow key={resto.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-semibold">
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive">{idx + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{resto.name}</TableCell>
                        <TableCell className="text-muted-foreground">{resto.city}</TableCell>
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
