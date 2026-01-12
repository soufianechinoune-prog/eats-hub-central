import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Store, TrendingUp, TrendingDown } from "lucide-react";
import { OffersCampaign } from "@/hooks/useMarketingCampaigns";
import { useMemo } from "react";

interface RestaurantCampaignComparisonProps {
  offers: OffersCampaign[];
}

export function RestaurantCampaignComparison({ offers }: RestaurantCampaignComparisonProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  // Aggregate by restaurant
  const restaurantPerformance = useMemo(() => {
    const byRestaurant: Record<string, {
      name: string;
      campaigns: number;
      sales: number;
      orders: number;
      newCustomers: number;
      avgBasket: number;
      salesPerCampaign: number;
      newCustomerRate: number;
    }> = {};

    offers.forEach((offer) => {
      const restaurantId = offer.restaurant_id || offer.restaurant_ids?.[0] || "unknown";
      const restaurantName = offer.restaurant_names?.[0] || "Inconnu";
      
      if (!byRestaurant[restaurantId]) {
        byRestaurant[restaurantId] = { 
          name: restaurantName,
          campaigns: 0, 
          sales: 0, 
          orders: 0, 
          newCustomers: 0, 
          avgBasket: 0,
          salesPerCampaign: 0,
          newCustomerRate: 0
        };
      }
      
      byRestaurant[restaurantId].campaigns++;
      byRestaurant[restaurantId].sales += offer.generated_sales;
      byRestaurant[restaurantId].orders += offer.orders;
      byRestaurant[restaurantId].newCustomers += offer.new_customers;
    });

    // Calculate KPIs
    Object.keys(byRestaurant).forEach((id) => {
      const data = byRestaurant[id];
      data.avgBasket = data.orders > 0 ? data.sales / data.orders : 0;
      data.salesPerCampaign = data.campaigns > 0 ? data.sales / data.campaigns : 0;
      data.newCustomerRate = data.orders > 0 ? (data.newCustomers / data.orders) * 100 : 0;
    });

    return Object.entries(byRestaurant)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.sales - a.sales);
  }, [offers]);

  // Global average for comparison
  const globalAvg = useMemo(() => {
    const totalSales = restaurantPerformance.reduce((sum, r) => sum + r.sales, 0);
    const totalCampaigns = restaurantPerformance.reduce((sum, r) => sum + r.campaigns, 0);
    const totalOrders = restaurantPerformance.reduce((sum, r) => sum + r.orders, 0);
    const totalNewCustomers = restaurantPerformance.reduce((sum, r) => sum + r.newCustomers, 0);
    
    return {
      avgBasket: totalOrders > 0 ? totalSales / totalOrders : 0,
      salesPerCampaign: totalCampaigns > 0 ? totalSales / totalCampaigns : 0,
      newCustomerRate: totalOrders > 0 ? (totalNewCustomers / totalOrders) * 100 : 0,
    };
  }, [restaurantPerformance]);

  // Chart data
  const chartData = restaurantPerformance.slice(0, 10).map((r) => ({
    name: r.name.length > 20 ? r.name.substring(0, 20) + "..." : r.name,
    sales: r.sales,
    salesPerCampaign: r.salesPerCampaign,
  }));

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Comparaison des restaurants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                className="text-xs" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis className="text-xs" />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === "sales" ? "CA total" : "CA/campagne"
                ]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar
                dataKey="sales"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="CA total"
              />
              <Bar
                dataKey="salesPerCampaign"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
                name="CA/campagne"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance par restaurant</CardTitle>
          <p className="text-sm text-muted-foreground">
            Comparaison avec la moyenne: Panier moy. {formatCurrency(globalAvg.avgBasket)} | 
            CA/campagne {formatCurrency(globalAvg.salesPerCampaign)} | 
            Taux nouveaux {globalAvg.newCustomerRate.toFixed(1)}%
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead className="text-center">Campagnes</TableHead>
                <TableHead className="text-right">CA total</TableHead>
                <TableHead className="text-right">CA/campagne</TableHead>
                <TableHead className="text-right">Panier moyen</TableHead>
                <TableHead className="text-right">Taux nouveaux</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restaurantPerformance.map((restaurant) => (
                <TableRow key={restaurant.id}>
                  <TableCell className="font-medium">{restaurant.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{restaurant.campaigns}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">
                    {formatCurrency(restaurant.sales)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {formatCurrency(restaurant.salesPerCampaign)}
                      {restaurant.salesPerCampaign > globalAvg.salesPerCampaign ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {formatCurrency(restaurant.avgBasket)}
                      {restaurant.avgBasket > globalAvg.avgBasket ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant="outline"
                      className={restaurant.newCustomerRate > globalAvg.newCustomerRate 
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" 
                        : "bg-red-500/10 text-red-700 border-red-500/30"
                      }
                    >
                      {restaurant.newCustomerRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
