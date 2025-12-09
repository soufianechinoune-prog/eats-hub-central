import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  TrendingDown,
  Euro,
  Package,
  FileWarning,
  Loader2,
  Target,
  Info,
} from "lucide-react";
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
import { ErrorRateEvolutionChart } from "./ErrorRateEvolutionChart";
import { FinancialImpactByCategory } from "./FinancialImpactByCategory";

interface OrderAccuracyDashboardProps {
  selectedRestaurant: string;
  selectedYear: number;
  selectedMonth: number | "all";
  restaurants: Array<{ id: string; name: string }>;
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  "Articles manquants": "#ef4444",
  "Personnalisation manquante": "#8b5cf6",
  "Mauvaise commande": "#3b82f6",
  "Article incorrect": "#f97316",
};

export function OrderAccuracyDashboard({
  selectedRestaurant,
  selectedYear,
  selectedMonth,
  restaurants,
}: OrderAccuracyDashboardProps) {
  const [objective, setObjective] = useState(2);
  const [chartType, setChartType] = useState<"line" | "bar">("bar");

  // Fetch monthly order accuracy from new official Uber data table
  const { data: monthlyAccuracy, isLoading: isLoadingAccuracy } = useQuery({
    queryKey: ["monthly-order-accuracy", selectedRestaurant, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("monthly_order_accuracy")
        .select("*")
        .eq("year", selectedYear)
        .eq("period_type", "current")
        .order("month", { ascending: true });

      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching monthly accuracy:", error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch product issues ranking
  const { data: productIssues, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["product-issues-ranking", selectedRestaurant, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("product_issues_ranking")
        .select("*")
        .eq("year", selectedYear)
        .order("volume", { ascending: false })
        .limit(10);

      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching product issues:", error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch sales data for error rate calculation
  const { data: salesData } = useQuery({
    queryKey: ["sales-for-error-rate", selectedRestaurant, selectedYear, restaurants],
    queryFn: async () => {
      const restaurantIds = selectedRestaurant === "all" 
        ? restaurants.map(r => r.id)
        : [selectedRestaurant];
      
      const { data, error } = await supabase.rpc("get_monthly_sales_from_daily", {
        p_year: selectedYear,
        p_restaurant_ids: restaurantIds,
        p_period_type: "current",
      });
      
      if (error) return [];
      return data || [];
    },
  });

  // Aggregate monthly data
  const aggregatedData = useMemo(() => {
    if (!monthlyAccuracy || monthlyAccuracy.length === 0) return null;

    const filtered = selectedMonth === "all" 
      ? monthlyAccuracy 
      : monthlyAccuracy.filter(m => m.month === selectedMonth);

    const totals = filtered.reduce((acc, m) => ({
      incorrect_orders: acc.incorrect_orders + (m.incorrect_orders_count || 0),
      missing_items: acc.missing_items + (m.missing_items_count || 0),
      missing_items_refund: acc.missing_items_refund + (m.missing_items_refund || 0),
      missing_customization: acc.missing_customization + (m.missing_customization_count || 0),
      missing_customization_refund: acc.missing_customization_refund + (m.missing_customization_refund || 0),
      wrong_order: acc.wrong_order + (m.wrong_order_count || 0),
      wrong_order_refund: acc.wrong_order_refund + (m.wrong_order_refund || 0),
      incorrect_item: acc.incorrect_item + (m.incorrect_item_count || 0),
      incorrect_item_refund: acc.incorrect_item_refund + (m.incorrect_item_refund || 0),
      total_refund: acc.total_refund + (m.total_refund || 0),
    }), {
      incorrect_orders: 0,
      missing_items: 0,
      missing_items_refund: 0,
      missing_customization: 0,
      missing_customization_refund: 0,
      wrong_order: 0,
      wrong_order_refund: 0,
      incorrect_item: 0,
      incorrect_item_refund: 0,
      total_refund: 0,
    });

    return totals;
  }, [monthlyAccuracy, selectedMonth]);

  // Calculate order count from sales data for error rate
  const orderCount = useMemo(() => {
    if (!salesData || salesData.length === 0) return 0;
    
    const monthsWithData = monthlyAccuracy?.map(m => m.month) || [];
    
    if (selectedMonth !== "all") {
      return salesData
        .filter((r: any) => r.month === selectedMonth)
        .reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
    }
    
    return salesData
      .filter((r: any) => monthsWithData.includes(r.month))
      .reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
  }, [salesData, selectedMonth, monthlyAccuracy]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!aggregatedData) return null;

    const totalErrors = aggregatedData.incorrect_orders;
    const totalImpact = aggregatedData.total_refund;
    const avgImpact = totalErrors > 0 ? totalImpact / totalErrors : 0;
    const errorRate = orderCount && orderCount > 0 ? (totalErrors / orderCount) * 100 : 0;
    const meetsObjective = errorRate <= objective;

    return {
      totalErrors,
      totalImpact,
      avgImpact,
      errorRate,
      orderCount,
      meetsObjective,
      hasSalesData: orderCount > 0,
    };
  }, [aggregatedData, orderCount, objective]);

  // Build evolution data for chart
  const errorEvolutionData = useMemo(() => {
    if (!monthlyAccuracy) return [];

    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

    // Group by month
    const monthlyData: Record<number, { errors: number; refund: number }> = {};
    monthlyAccuracy.forEach(m => {
      if (!monthlyData[m.month]) {
        monthlyData[m.month] = { errors: 0, refund: 0 };
      }
      monthlyData[m.month].errors += m.incorrect_orders_count || 0;
      monthlyData[m.month].refund += m.total_refund || 0;
    });

    // Get order counts by month from sales data
    const monthlyOrders: Record<number, number> = {};
    (salesData || []).forEach((r: any) => {
      monthlyOrders[r.month] = (monthlyOrders[r.month] || 0) + (r.order_count || 0);
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([month, data]) => {
        const orders = monthlyOrders[parseInt(month)] || 0;
        return {
          period: `${selectedYear}-${String(month).padStart(2, "0")}`,
          label: monthNames[parseInt(month) - 1],
          errorRate: orders > 0 ? (data.errors / orders) * 100 : null,
          errorCount: data.errors,
          orderCount: orders,
          hasSalesData: orders > 0,
        };
      });
  }, [monthlyAccuracy, salesData, selectedYear]);

  // Financial impact by category
  const categoryData = useMemo(() => {
    if (!aggregatedData) return [];

    return [
      { name: "Articles manquants", count: aggregatedData.missing_items, impact: aggregatedData.missing_items_refund },
      { name: "Personnalisation manquante", count: aggregatedData.missing_customization, impact: aggregatedData.missing_customization_refund },
      { name: "Mauvaise commande", count: aggregatedData.wrong_order, impact: aggregatedData.wrong_order_refund },
      { name: "Article incorrect", count: aggregatedData.incorrect_item, impact: aggregatedData.incorrect_item_refund },
    ].filter(c => c.count > 0);
  }, [aggregatedData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const isLoading = isLoadingAccuracy || isLoadingProducts;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!monthlyAccuracy || monthlyAccuracy.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileWarning className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Aucune donnée disponible</p>
          <p className="text-muted-foreground text-center max-w-md">
            Importez le fichier "Résumé commandes incorrectes" (order-accuracy-inaccurate-issues-summary) depuis Uber Eats pour visualiser les statistiques.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info about data source */}
      <Alert className="border-blue-500/50 bg-blue-500/10">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-700 dark:text-blue-400">
          Données officielles Uber Eats importées depuis le rapport "order-accuracy-inaccurate-issues-summary".
        </AlertDescription>
      </Alert>

      {/* Warning if sales data missing */}
      {kpis && !kpis.hasSalesData && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Données de ventes manquantes. Le taux d'erreur ne peut pas être calculé. Importez le rapport "Sales Over Time".
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taux d'erreurs
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis?.hasSalesData ? (kpis?.meetsObjective ? "text-primary" : "text-destructive") : "text-muted-foreground"}`}>
              {kpis?.hasSalesData ? `${kpis?.errorRate.toFixed(2)}%` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis?.totalErrors} erreurs{kpis?.hasSalesData ? ` / ${kpis?.orderCount} commandes` : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              vs Objectif ({objective}%)
            </CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis?.hasSalesData ? (kpis?.meetsObjective ? "text-primary" : "text-destructive") : "text-muted-foreground"}`}>
              {kpis?.hasSalesData ? (kpis?.meetsObjective ? "✓ Atteint" : "✗ Non atteint") : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis?.hasSalesData && kpis?.meetsObjective 
                ? `${(objective - (kpis?.errorRate || 0)).toFixed(2)}% sous l'objectif`
                : kpis?.hasSalesData 
                  ? `${((kpis?.errorRate || 0) - objective).toFixed(2)}% au-dessus`
                  : "Données ventes requises"
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coût total remboursements
            </CardTitle>
            <Euro className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(kpis?.totalImpact || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Impact financier sur la période
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coût moyen par erreur
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis?.avgImpact || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Moyenne par commande incorrecte
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commandes incorrectes
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.totalErrors}</div>
            <p className="text-xs text-muted-foreground">
              Total commandes avec problèmes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Rate Evolution */}
      <ErrorRateEvolutionChart
        data={errorEvolutionData}
        objective={objective}
        onObjectiveChange={setObjective}
        chartType={chartType}
        onChartTypeChange={setChartType}
        periodMode="year"
        selectedMonth={null}
        onDrillDown={() => {}}
        onBackToYear={() => {}}
        onPrevMonth={() => {}}
        onNextMonth={() => {}}
      />

      {/* Financial Impact by Category */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Impact financier par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={150} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => label}
                  />
                  <Bar 
                    dataKey="impact" 
                    name="Remboursements" 
                    fill="hsl(var(--destructive))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        {/* Top Problematic Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">TOP 10 - Articles problématiques</CardTitle>
          </CardHeader>
          <CardContent>
            {productIssues && productIssues.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productIssues.map((item: any, index: number) => (
                      <TableRow key={item.id || index}>
                        <TableCell className="max-w-[200px] truncate">
                          {item.item_title}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.volume}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.score > 50 ? "destructive" : "secondary"}>
                            {item.score?.toFixed(1) || "N/A"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Importez le fichier "item-issues-leaderboard" pour voir le classement
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Détail mensuel</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">Incorrectes</TableHead>
                  <TableHead className="text-right">Articles manquants</TableHead>
                  <TableHead className="text-right">Perso. manquante</TableHead>
                  <TableHead className="text-right">Mauvaise commande</TableHead>
                  <TableHead className="text-right">Article incorrect</TableHead>
                  <TableHead className="text-right">Remboursé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyAccuracy
                  .sort((a, b) => a.month - b.month)
                  .map((m) => {
                    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {monthNames[m.month - 1]} {m.year}
                        </TableCell>
                        <TableCell className="text-right">{m.incorrect_orders_count}</TableCell>
                        <TableCell className="text-right">{m.missing_items_count}</TableCell>
                        <TableCell className="text-right">{m.missing_customization_count}</TableCell>
                        <TableCell className="text-right">{m.wrong_order_count}</TableCell>
                        <TableCell className="text-right">{m.incorrect_item_count}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">
                          {formatCurrency(m.total_refund || 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
