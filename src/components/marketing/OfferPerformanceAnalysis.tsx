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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  Legend,
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Award, 
  ShoppingBag,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Calendar
} from "lucide-react";
import { OffersCampaign } from "@/hooks/useMarketingCampaigns";
import { useMemo, useState } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface OfferPerformanceAnalysisProps {
  offers: OffersCampaign[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function OfferPerformanceAnalysis({ offers }: OfferPerformanceAnalysisProps) {
  const [selectedOfferType, setSelectedOfferType] = useState<string>("all");
  
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  // Get unique offer types for dropdown
  const offerTypes = useMemo(() => {
    const types = new Set(offers.map(o => o.offer_type || "Autre"));
    return Array.from(types).sort();
  }, [offers]);

  // Filter offers based on selected type
  const filteredOffers = useMemo(() => {
    if (selectedOfferType === "all") return [];
    return offers
      .filter(o => (o.offer_type || "Autre") === selectedOfferType)
      .map(offer => {
        const avgBasket = offer.orders > 0 ? offer.generated_sales / offer.orders : 0;
        const duration = offer.start_date && offer.end_date 
          ? differenceInDays(parseISO(offer.end_date), parseISO(offer.start_date)) + 1
          : null;
        return { ...offer, avgBasket, duration };
      })
      .sort((a, b) => b.generated_sales - a.generated_sales);
  }, [offers, selectedOfferType]);

  // Summary stats for filtered offers
  const filteredStats = useMemo(() => {
    if (filteredOffers.length === 0) return null;
    return {
      count: filteredOffers.length,
      totalSales: filteredOffers.reduce((sum, o) => sum + o.generated_sales, 0),
      totalOrders: filteredOffers.reduce((sum, o) => sum + o.orders, 0),
      totalNewCustomers: filteredOffers.reduce((sum, o) => sum + o.new_customers, 0),
    };
  }, [filteredOffers]);

  // Calculate enriched metrics for each offer
  const enrichedOffers = useMemo(() => {
    return offers.map((offer) => {
      const avgBasket = offer.orders > 0 ? offer.generated_sales / offer.orders : 0;
      const salesPerNewCustomer = offer.new_customers > 0 ? offer.generated_sales / offer.new_customers : 0;
      const newCustomerRate = offer.orders > 0 ? (offer.new_customers / offer.orders) * 100 : 0;
      
      return {
        ...offer,
        avgBasket,
        salesPerNewCustomer,
        newCustomerRate,
      };
    });
  }, [offers]);

  // Performance by offer type with calculated KPIs
  const performanceByType = useMemo(() => {
    const byType: Record<string, {
      count: number;
      sales: number;
      orders: number;
      newCustomers: number;
      avgBasket: number;
      salesPerNewCustomer: number;
      newCustomerRate: number;
    }> = {};

    enrichedOffers.forEach((offer) => {
      const type = offer.offer_type || "Autre";
      if (!byType[type]) {
        byType[type] = { count: 0, sales: 0, orders: 0, newCustomers: 0, avgBasket: 0, salesPerNewCustomer: 0, newCustomerRate: 0 };
      }
      byType[type].count++;
      byType[type].sales += offer.generated_sales;
      byType[type].orders += offer.orders;
      byType[type].newCustomers += offer.new_customers;
    });

    // Calculate averages
    Object.keys(byType).forEach((type) => {
      const data = byType[type];
      data.avgBasket = data.orders > 0 ? data.sales / data.orders : 0;
      data.salesPerNewCustomer = data.newCustomers > 0 ? data.sales / data.newCustomers : 0;
      data.newCustomerRate = data.orders > 0 ? (data.newCustomers / data.orders) * 100 : 0;
    });

    return Object.entries(byType).map(([type, data]) => ({
      type,
      ...data,
    })).sort((a, b) => b.sales - a.sales);
  }, [enrichedOffers]);

  // Top 10 best performing campaigns by average basket
  const topByAvgBasket = useMemo(() => {
    return [...enrichedOffers]
      .filter((o) => o.orders > 0)
      .sort((a, b) => b.avgBasket - a.avgBasket)
      .slice(0, 10);
  }, [enrichedOffers]);

  // Top 10 by new customers
  const topByNewCustomers = useMemo(() => {
    return [...enrichedOffers]
      .sort((a, b) => b.new_customers - a.new_customers)
      .slice(0, 10);
  }, [enrichedOffers]);

  // Scatter plot data: Orders vs New Customers
  const scatterData = useMemo(() => {
    return enrichedOffers
      .filter((o) => o.orders > 0)
      .map((o) => ({
        x: o.orders,
        y: o.new_customers,
        z: o.generated_sales,
        name: o.title || o.items_affected || "N/A",
        type: o.offer_type || "Autre",
      }));
  }, [enrichedOffers]);

  // Global KPIs
  const globalKpis = useMemo(() => {
    const totalSales = enrichedOffers.reduce((sum, o) => sum + o.generated_sales, 0);
    const totalOrders = enrichedOffers.reduce((sum, o) => sum + o.orders, 0);
    const totalNewCustomers = enrichedOffers.reduce((sum, o) => sum + o.new_customers, 0);
    
    return {
      avgBasketGlobal: totalOrders > 0 ? totalSales / totalOrders : 0,
      salesPerNewCustomerGlobal: totalNewCustomers > 0 ? totalSales / totalNewCustomers : 0,
      newCustomerRateGlobal: totalOrders > 0 ? (totalNewCustomers / totalOrders) * 100 : 0,
    };
  }, [enrichedOffers]);

  return (
    <div className="space-y-6">
      {/* Calculated KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Panier moyen global</p>
                <p className="text-2xl font-bold">{formatCurrency(globalKpis.avgBasketGlobal)}</p>
                <p className="text-xs text-muted-foreground">par commande promo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CA par nouveau client</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(globalKpis.salesPerNewCustomerGlobal)}
                </p>
                <p className="text-xs text-muted-foreground">valeur d'acquisition</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taux nouveaux clients</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {globalKpis.newCustomerRateGlobal.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">des commandes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Type Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Comparaison par type d'offre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type d'offre</TableHead>
                <TableHead className="text-center">Campagnes</TableHead>
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">Commandes</TableHead>
                <TableHead className="text-right">Nouveaux clients</TableHead>
                <TableHead className="text-right">Panier moyen</TableHead>
                <TableHead className="text-right">CA/Nouveau client</TableHead>
                <TableHead className="text-right">Taux acquisition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performanceByType.map((item, idx) => (
                <TableRow key={item.type}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      {item.type}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{item.count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {formatCurrency(item.sales)}
                  </TableCell>
                  <TableCell className="text-right">{item.orders.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="text-right">{item.newCustomers.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.avgBasket)}
                  </TableCell>
                  <TableCell className="text-right text-blue-600">
                    {formatCurrency(item.salesPerNewCustomer)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant="outline" 
                      className={item.newCustomerRate > globalKpis.newCustomerRateGlobal 
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" 
                        : ""
                      }
                    >
                      {item.newCustomerRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drill-down by Offer Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Détail par type d'offre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedOfferType} onValueChange={setSelectedOfferType}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Sélectionner un type d'offre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">-- Sélectionner un type --</SelectItem>
                {offerTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {filteredStats && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span><strong>{filteredStats.count}</strong> campagnes</span>
                <span>•</span>
                <span className="text-emerald-600 font-medium">{formatCurrency(filteredStats.totalSales)}</span>
                <span>•</span>
                <span><strong>{filteredStats.totalNewCustomers}</strong> nouveaux clients</span>
              </div>
            )}
          </div>

          {selectedOfferType !== "all" && filteredOffers.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit / Titre</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-center">Durée</TableHead>
                    <TableHead className="text-right">Ventes</TableHead>
                    <TableHead className="text-right">Commandes</TableHead>
                    <TableHead className="text-right">Nouveaux</TableHead>
                    <TableHead className="text-right">Panier moy.</TableHead>
                    <TableHead>Audience</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffers.map((offer) => (
                    <TableRow key={offer.id}>
                      <TableCell className="font-medium max-w-[200px]">
                        <p className="truncate">{offer.title || offer.items_affected || "N/A"}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {offer.restaurant?.name || "—"}
                      </TableCell>
                      <TableCell>
                        {offer.start_date && offer.end_date ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {format(parseISO(offer.start_date), "d MMM", { locale: fr })}
                              {" → "}
                              {format(parseISO(offer.end_date), "d MMM", { locale: fr })}
                            </span>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {offer.duration ? (
                          <Badge variant="outline">{offer.duration}j</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(offer.generated_sales)}
                      </TableCell>
                      <TableCell className="text-right">
                        {offer.orders.toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-blue-600 font-medium">
                          {offer.new_customers.toLocaleString("fr-FR")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(offer.avgBasket)}
                      </TableCell>
                      <TableCell>
                        {offer.audience ? (
                          <Badge variant="secondary" className="text-xs">
                            {offer.audience}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : selectedOfferType === "all" ? (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Sélectionnez un type d'offre pour voir le détail des campagnes</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucune campagne trouvée pour ce type d'offre</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Scatter Plot: Orders vs New Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commandes vs Nouveaux clients</CardTitle>
            <p className="text-sm text-muted-foreground">
              Taille des bulles = CA généré
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Commandes" 
                  className="text-xs"
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Nouveaux clients" 
                  className="text-xs"
                />
                <ZAxis type="number" dataKey="z" range={[50, 400]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border rounded-lg p-3 shadow-lg">
                          <p className="font-medium text-sm mb-1">{data.name}</p>
                          <p className="text-xs text-muted-foreground">{data.type}</p>
                          <div className="mt-2 space-y-1 text-xs">
                            <p>Commandes: {data.x}</p>
                            <p>Nouveaux clients: {data.y}</p>
                            <p>CA: {formatCurrency(data.z)}</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      fillOpacity={0.7}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart: Average Basket by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Panier moyen par type d'offre</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceByType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis 
                  dataKey="type" 
                  type="category" 
                  width={150} 
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar 
                  dataKey="avgBasket" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  name="Panier moyen"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top by Average Basket */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Top 10 - Meilleur panier moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topByAvgBasket.map((offer, idx) => (
                <div 
                  key={offer.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">
                        {offer.title || offer.items_affected || "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {offer.restaurant?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">
                      {formatCurrency(offer.avgBasket)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {offer.orders} cmd
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top by New Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-blue-600" />
              Top 10 - Plus de nouveaux clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topByNewCustomers.map((offer, idx) => (
                <div 
                  key={offer.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">
                        {offer.title || offer.items_affected || "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {offer.restaurant?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">
                      {offer.new_customers} nouveaux
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(offer.generated_sales)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
