import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { ConversionTab } from "@/components/dashboard/ConversionTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Euro, ShoppingCart, TrendingUp, Ticket, Percent } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DateRange, RestaurantPerformance } from "@/types";

const Dashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>("7");
  const [activeTab, setActiveTab] = useState("overview");
  const navigate = useNavigate();

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["dashboard-kpis", dateRange],
    queryFn: async () => {
      const daysAgo = parseInt(dateRange);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysAgo);

      const { data: orders } = await supabase
        .from("orders")
        .select("gross_amount, net_amount")
        .gte("order_datetime", fromDate.toISOString());

      const totalGross = orders?.reduce((sum, o) => sum + (o.gross_amount || 0), 0) || 0;
      const totalNet = orders?.reduce((sum, o) => sum + (o.net_amount || 0), 0) || 0;
      const totalOrders = orders?.length || 0;
      const avgTicket = totalOrders > 0 ? totalGross / totalOrders : 0;

      return {
        totalGrossRevenue: totalGross,
        totalNetRevenue: totalNet,
        totalOrders,
        averageTicket: avgTicket,
      };
    },
  });

  // Fetch restaurant performance
  const { data: restaurantPerformance, isLoading: perfLoading } = useQuery({
    queryKey: ["restaurant-performance", dateRange],
    queryFn: async () => {
      const daysAgo = parseInt(dateRange);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysAgo);

      const { data: restaurants } = await supabase
        .from("restaurants")
        .select(`
          *,
          uber_connections (*)
        `)
        .eq("is_active", true);

      if (!restaurants) return [];

      const performance: RestaurantPerformance[] = await Promise.all(
        restaurants.map(async (restaurant) => {
          const { data: orders } = await supabase
            .from("orders")
            .select("gross_amount, net_amount")
            .eq("restaurant_id", restaurant.id)
            .gte("order_datetime", fromDate.toISOString());

          const { data: promotions } = await supabase
            .from("promotions")
            .select("id")
            .eq("restaurant_id", restaurant.id)
            .lte("start_at", new Date().toISOString())
            .gte("end_at", new Date().toISOString());

          const grossRevenue = orders?.reduce((sum, o) => sum + (o.gross_amount || 0), 0) || 0;
          const netRevenue = orders?.reduce((sum, o) => sum + (o.net_amount || 0), 0) || 0;

          return {
            restaurant,
            grossRevenue,
            netRevenue,
            ordersCount: orders?.length || 0,
            activePromotions: promotions?.length || 0,
            hasConnection: Array.isArray(restaurant.uber_connections) && restaurant.uber_connections.length > 0,
          };
        })
      );

      return performance.sort((a, b) => b.grossRevenue - a.grossRevenue);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Vue d'ensemble</h2>
          <p className="text-muted-foreground">
            Performances globales de vos restaurants
          </p>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Aujourd'hui</SelectItem>
            <SelectItem value="7">7 derniers jours</SelectItem>
            <SelectItem value="30">30 derniers jours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Euro className="h-4 w-4" />
            Revenus
          </TabsTrigger>
          <TabsTrigger value="conversion" className="gap-2">
            <Percent className="h-4 w-4" />
            Taux de conversion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="CA Brut"
              value={formatCurrency(kpis?.totalGrossRevenue || 0)}
              icon={Euro}
            />
            <KPICard
              title="CA Net"
              value={formatCurrency(kpis?.totalNetRevenue || 0)}
              icon={TrendingUp}
            />
            <KPICard
              title="Commandes"
              value={kpis?.totalOrders || 0}
              icon={ShoppingCart}
            />
            <KPICard
              title="Panier Moyen"
              value={formatCurrency(kpis?.averageTicket || 0)}
              icon={Ticket}
            />
          </div>

          {/* Restaurant comparison table */}
          <Card>
            <CardHeader>
              <CardTitle>Comparaison des restaurants</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead className="text-right">CA Brut</TableHead>
                    <TableHead className="text-right">CA Net</TableHead>
                    <TableHead className="text-right">Commandes</TableHead>
                    <TableHead className="text-center">Promos</TableHead>
                    <TableHead className="text-center">Connexion</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restaurantPerformance?.map((perf) => (
                    <TableRow key={perf.restaurant.id}>
                      <TableCell className="font-medium">
                        {perf.restaurant.name}
                      </TableCell>
                      <TableCell>{perf.restaurant.city}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(perf.grossRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(perf.netRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {perf.ordersCount}
                      </TableCell>
                      <TableCell className="text-center">
                        {perf.activePromotions > 0 ? (
                          <Badge variant="outline">{perf.activePromotions}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {perf.hasConnection ? (
                          <Badge className="bg-accent">Connecté</Badge>
                        ) : (
                          <Badge variant="outline">Non connecté</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/restaurants/${perf.restaurant.id}`)
                          }
                        >
                          Détails
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversion" className="mt-6">
          <ConversionTab dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
