import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  AlertTriangle,
  BarChart3,
  RefreshCcw
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from "recharts";
import { useItemSalesAnalytics } from "@/hooks/useItemSalesAnalytics";
import { format, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
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

interface ItemSalesAnalyticsProps {
  restaurantIds?: string[];
  startDate: Date;
  endDate: Date;
}

export function ItemSalesAnalytics({
  restaurantIds,
  startDate,
  endDate,
}: ItemSalesAnalyticsProps) {
  const {
    topProducts,
    flopProducts,
    refundAnalysis,
    monthlyEvolution,
    kpis,
    isLoading,
  } = useItemSalesAnalytics(restaurantIds, startDate, endDate);

  const [selectedEvolutionItems, setSelectedEvolutionItems] = useState<string[]>([]);

  // Format currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);

  // Truncate long names
  const truncateName = (name: string, maxLength = 25) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + "...";
  };

  // Prepare evolution chart data
  const evolutionChartData = useMemo(() => {
    if (!monthlyEvolution.length) return [];

    // Get top 5 products for evolution
    const topItemIds = topProducts.slice(0, 5).map((p) => p.item_id);
    
    // If no selection, use top products
    const itemsToShow = selectedEvolutionItems.length > 0 
      ? selectedEvolutionItems 
      : topItemIds;

    // Group by month
    const monthMap = new Map<string, Record<string, number>>();
    
    monthlyEvolution
      .filter((e) => itemsToShow.includes(e.item_id))
      .forEach((e) => {
        if (!monthMap.has(e.date)) {
          monthMap.set(e.date, {});
        }
        const month = monthMap.get(e.date)!;
        month[e.item_id] = (month[e.item_id] || 0) + e.sales;
      });

    return Array.from(monthMap.entries())
      .map(([date, items]) => ({
        date,
        label: format(new Date(date + "-01"), "MMM yy", { locale: fr }),
        ...items,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [monthlyEvolution, topProducts, selectedEvolutionItems]);

  // Colors for chart
  const chartColors = [
    "hsl(var(--primary))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="backdrop-blur-xl bg-card/70 border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Produits vendus</span>
            </div>
            <p className="text-2xl font-bold">{kpis.uniqueProducts}</p>
            <p className="text-xs text-muted-foreground">
              {kpis.totalQuantity.toLocaleString("fr-FR")} unités
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-card/70 border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">CA Total</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(kpis.totalSales)}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(kpis.avgBasketContribution)} / unité
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-card/70 border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCcw className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Remboursements</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(kpis.totalRefunds)}</p>
            <p className="text-xs text-muted-foreground">
              {kpis.refundRate.toFixed(1)}% du CA
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-card/70 border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Prix moyen</span>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(kpis.avgBasketContribution)}
            </p>
            <p className="text-xs text-muted-foreground">par article</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="top-flop" className="space-y-4">
        <TabsList>
          <TabsTrigger value="top-flop">Top & Flop</TabsTrigger>
          <TabsTrigger value="evolution">Évolution</TabsTrigger>
          <TabsTrigger value="refunds">Remboursements</TabsTrigger>
        </TabsList>

        {/* Top & Flop Tab */}
        <TabsContent value="top-flop" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card className="backdrop-blur-xl bg-card/70 border-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-emerald-500/10">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <CardTitle className="text-base">Top 10 Produits</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={topProducts}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="item_title"
                        width={120}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => truncateName(value, 18)}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload?.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-card border rounded-lg p-3 shadow-lg">
                                <p className="font-medium text-sm">{d.item_title}</p>
                                <p className="text-sm mt-1">
                                  CA: <strong>{formatCurrency(d.net_sales)}</strong>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {d.total_quantity} vendus • {d.order_count} commandes
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="net_sales" radius={[0, 4, 4, 0]}>
                        {topProducts.map((_, index) => (
                          <Cell
                            key={`cell-top-${index}`}
                            fill={`hsl(142 ${70 - index * 5}% ${40 + index * 3}%)`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée disponible
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Flop Products */}
            <Card className="backdrop-blur-xl bg-card/70 border-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-red-500/10">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  </div>
                  <CardTitle className="text-base">Produits à améliorer</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {flopProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={flopProducts}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="item_title"
                        width={120}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => truncateName(value, 18)}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload?.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-card border rounded-lg p-3 shadow-lg">
                                <p className="font-medium text-sm">{d.item_title}</p>
                                <p className="text-sm mt-1">
                                  CA Net: <strong>{formatCurrency(d.net_sales)}</strong>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Remb: {formatCurrency(d.total_refunds)} • Promos: {formatCurrency(d.total_promos)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="net_sales" radius={[0, 4, 4, 0]}>
                        {flopProducts.map((_, index) => (
                          <Cell
                            key={`cell-flop-${index}`}
                            fill={`hsl(0 ${80 - index * 5}% ${50 + index * 3}%)`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée disponible
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evolution Tab */}
        <TabsContent value="evolution" className="space-y-4">
          <Card className="backdrop-blur-xl bg-card/70 border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Évolution des ventes par produit</CardTitle>
                <Select
                  value={selectedEvolutionItems.length > 0 ? "custom" : "top5"}
                  onValueChange={(val) => {
                    if (val === "top5") {
                      setSelectedEvolutionItems([]);
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sélection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top5">Top 5 produits</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {evolutionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={evolutionChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload?.length) {
                          return (
                            <div className="bg-card border rounded-lg p-3 shadow-lg">
                              <p className="font-medium text-sm mb-2">{label}</p>
                              {payload.map((p, i) => (
                                <p key={i} className="text-sm" style={{ color: p.color }}>
                                  {topProducts.find((t) => t.item_id === p.dataKey)?.item_title?.substring(0, 20) || p.dataKey}:{" "}
                                  <strong>{formatCurrency(p.value as number)}</strong>
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    {(selectedEvolutionItems.length > 0
                      ? selectedEvolutionItems
                      : topProducts.slice(0, 5).map((p) => p.item_id)
                    ).map((itemId, i) => (
                      <Line
                        key={itemId}
                        type="monotone"
                        dataKey={itemId}
                        name={truncateName(topProducts.find((p) => p.item_id === itemId)?.item_title || itemId, 20)}
                        stroke={chartColors[i % chartColors.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  Aucune donnée d'évolution disponible
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Refunds Tab */}
        <TabsContent value="refunds" className="space-y-4">
          <Card className="backdrop-blur-xl bg-card/70 border-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-orange-500/10">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </div>
                <CardTitle className="text-base">Analyse des remboursements par article</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {refundAnalysis.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Remboursements</TableHead>
                      <TableHead className="text-right">Commandes</TableHead>
                      <TableHead className="text-right">Taux</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundAnalysis.slice(0, 15).map((item) => (
                      <TableRow key={item.item_id}>
                        <TableCell className="font-medium max-w-[250px] truncate">
                          {item.item_title}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {formatCurrency(item.refund_amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.total_orders}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={item.refund_rate > 10 ? "destructive" : "secondary"}
                          >
                            {item.refund_rate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Aucun remboursement sur la période
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
