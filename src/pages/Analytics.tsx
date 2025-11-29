import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, Euro, ShoppingCart, Users, Percent } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";

const MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

export default function Analytics() {
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch revenue data
  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ["analytics_revenue", selectedRestaurant, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("*")
        .eq("year", selectedYear)
        .order("month");
      
      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch conversion data
  const { data: conversionData, isLoading: loadingConversion } = useQuery({
    queryKey: ["analytics_conversion", selectedRestaurant, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_conversion")
        .select("*")
        .eq("year", selectedYear)
        .order("month");
      
      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch fees data
  const { data: feesData, isLoading: loadingFees } = useQuery({
    queryKey: ["analytics_fees", selectedRestaurant, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_fees")
        .select("*")
        .eq("year", selectedYear)
        .order("month");
      
      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Aggregate data by month (for "all" restaurants)
  const aggregatedRevenueData = useMemo(() => {
    if (!revenueData) return [];
    
    const monthlyData: { [key: number]: { revenue: number; orders: number; count: number } } = {};
    
    revenueData.forEach((item) => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = { revenue: 0, orders: 0, count: 0 };
      }
      monthlyData[item.month].revenue += Number(item.revenue_ttc) || 0;
      monthlyData[item.month].orders += item.order_count || 0;
      monthlyData[item.month].count += 1;
    });
    
    return Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i],
      monthNum: i + 1,
      revenue: monthlyData[i + 1]?.revenue || 0,
      orders: monthlyData[i + 1]?.orders || 0,
      avgBasket: monthlyData[i + 1]?.orders > 0 
        ? monthlyData[i + 1].revenue / monthlyData[i + 1].orders 
        : 0,
    }));
  }, [revenueData]);

  const aggregatedConversionData = useMemo(() => {
    if (!conversionData) return [];
    
    const monthlyData: { [key: number]: { visits: number; views: number; cart: number; orders: number } } = {};
    
    conversionData.forEach((item) => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = { visits: 0, views: 0, cart: 0, orders: 0 };
      }
      monthlyData[item.month].visits += item.visits || 0;
      monthlyData[item.month].views += item.menu_views || 0;
      monthlyData[item.month].cart += item.add_to_cart || 0;
      monthlyData[item.month].orders += item.orders || 0;
    });
    
    return Array.from({ length: 12 }, (_, i) => {
      const data = monthlyData[i + 1];
      return {
        month: MONTHS[i],
        monthNum: i + 1,
        visits: data?.visits || 0,
        views: data?.views || 0,
        cart: data?.cart || 0,
        orders: data?.orders || 0,
        conversionRate: data?.visits > 0 ? ((data.orders / data.visits) * 100) : 0,
      };
    });
  }, [conversionData]);

  const aggregatedFeesData = useMemo(() => {
    if (!feesData) return [];
    
    const monthlyData: { [key: number]: { uber: number; marketing: number; offers: number; ads: number; net: number } } = {};
    
    feesData.forEach((item) => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = { uber: 0, marketing: 0, offers: 0, ads: 0, net: 0 };
      }
      monthlyData[item.month].uber += Number(item.uber_fee) || 0;
      monthlyData[item.month].marketing += Number(item.marketing_fee) || 0;
      monthlyData[item.month].offers += Number(item.offers_cost) || 0;
      monthlyData[item.month].ads += Number(item.ads_cost) || 0;
      monthlyData[item.month].net += Number(item.net_payout) || 0;
    });
    
    return Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i],
      monthNum: i + 1,
      uber: monthlyData[i + 1]?.uber || 0,
      marketing: monthlyData[i + 1]?.marketing || 0,
      offers: monthlyData[i + 1]?.offers || 0,
      ads: monthlyData[i + 1]?.ads || 0,
      net: monthlyData[i + 1]?.net || 0,
      totalFees: (monthlyData[i + 1]?.uber || 0) + 
                 (monthlyData[i + 1]?.marketing || 0) + 
                 (monthlyData[i + 1]?.offers || 0) + 
                 (monthlyData[i + 1]?.ads || 0),
    }));
  }, [feesData]);

  // Calculate profitability data by month
  const profitabilityData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const revenueMonth = aggregatedRevenueData.find(r => r.monthNum === monthNum);
      const feesMonth = aggregatedFeesData.find(f => f.monthNum === monthNum);
      
      const revenue = revenueMonth?.revenue || 0;
      const netPayout = feesMonth?.net || 0;
      const profitability = revenue > 0 ? (netPayout / revenue) * 100 : 0;
      
      return {
        month: MONTHS[i],
        monthNum,
        revenue,
        netPayout,
        profitability,
      };
    });
  }, [aggregatedRevenueData, aggregatedFeesData]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalRevenue = aggregatedRevenueData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = aggregatedRevenueData.reduce((sum, d) => sum + d.orders, 0);
    const totalVisits = aggregatedConversionData.reduce((sum, d) => sum + d.visits, 0);
    const totalConvOrders = aggregatedConversionData.reduce((sum, d) => sum + d.orders, 0);
    const totalFees = aggregatedFeesData.reduce((sum, d) => sum + d.totalFees, 0);
    const totalNet = aggregatedFeesData.reduce((sum, d) => sum + d.net, 0);
    const profitability = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalOrders,
      avgBasket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      conversionRate: totalVisits > 0 ? (totalConvOrders / totalVisits) * 100 : 0,
      totalFees,
      totalNet,
      feePercentage: totalRevenue > 0 ? (totalFees / totalRevenue) * 100 : 0,
      profitability,
    };
  }, [aggregatedRevenueData, aggregatedConversionData, aggregatedFeesData]);

  const isLoading = loadingRevenue || loadingConversion || loadingFees;

  const hasData = revenueData?.length || conversionData?.length || feesData?.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Analyse de vos performances mensuelles
          </p>
        </div>
        
        <div className="flex gap-3">
          <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Restaurant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les restaurants</SelectItem>
              {restaurants?.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !hasData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-lg">
              Aucune donnée disponible pour {selectedYear}
            </p>
            <p className="text-muted-foreground mt-2">
              Commencez par saisir vos données dans les pages de saisie
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">CA Total</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {kpis.totalRevenue.toLocaleString("fr-FR")} €
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Commandes</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {kpis.totalOrders.toLocaleString("fr-FR")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Panier moy. {kpis.avgBasket.toFixed(2)} €
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Taux Conv.</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {kpis.conversionRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">Frais Totaux</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {kpis.totalFees.toLocaleString("fr-FR")} €
                </p>
                <p className="text-xs text-muted-foreground">
                  {kpis.feePercentage.toFixed(1)}% du CA
                </p>
              </CardContent>
            </Card>

            <Card className={kpis.profitability > 60 ? "border-green-500/50" : kpis.profitability > 40 ? "border-amber-500/50" : "border-destructive/50"}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className={`h-4 w-4 ${kpis.profitability > 60 ? "text-green-500" : kpis.profitability > 40 ? "text-amber-500" : "text-destructive"}`} />
                  <span className="text-sm text-muted-foreground">% Rentabilité</span>
                </div>
                <p className={`text-2xl font-bold mt-2 ${kpis.profitability > 60 ? "text-green-500" : kpis.profitability > 40 ? "text-amber-500" : "text-destructive"}`}>
                  {kpis.profitability.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Versement / CA
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Évolution du Chiffre d'Affaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={aggregatedRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'CA (€)') return [value.toLocaleString('fr-FR') + ' €', name];
                        return [value.toLocaleString('fr-FR'), name];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" name="CA (€)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="orders" name="Commandes" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: 'hsl(var(--chart-2))' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Conversion Funnel Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Funnel de Conversion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={aggregatedConversionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [value.toLocaleString('fr-FR'), '']}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="visits" name="Visites" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="views" name="Vues menu" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="cart" name="Ajouts panier" stackId="3" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="orders" name="Commandes" stackId="4" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Conversion Rate Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Taux de Conversion Global
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aggregatedConversionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" unit="%" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [value.toFixed(2) + '%', 'Taux de conversion']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="conversionRate" 
                      name="Taux de conversion" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Fees Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Répartition des Frais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aggregatedFeesData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => [value.toLocaleString('fr-FR') + ' €', name]}
                    />
                    <Legend />
                    <Bar dataKey="uber" name="Commission Uber" stackId="a" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="marketing" name="Marketing" stackId="a" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="offers" name="Offres" stackId="a" fill="hsl(var(--chart-3))" />
                    <Bar dataKey="ads" name="Publicité" stackId="a" fill="hsl(var(--chart-4))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Net Payout Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Versement Net vs Frais Totaux
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={aggregatedFeesData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => [value.toLocaleString('fr-FR') + ' €', name]}
                    />
                    <Legend />
                    <Bar dataKey="net" name="Versement Net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="totalFees" name="Total Frais" stroke="hsl(var(--destructive))" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Profitability Rate Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Taux de Rentabilité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={profitabilityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" unit="%" domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'Rentabilité') return [value.toFixed(1) + '%', name];
                        return [value.toLocaleString('fr-FR') + ' €', name];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" name="CA TTC" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} opacity={0.5} />
                    <Bar yAxisId="left" dataKey="netPayout" name="Versement Net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="profitability" 
                      name="Rentabilité" 
                      stroke="hsl(142.1 76.2% 36.3%)" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(142.1 76.2% 36.3%)', strokeWidth: 2, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}