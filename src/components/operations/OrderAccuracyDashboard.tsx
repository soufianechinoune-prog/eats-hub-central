import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ExternalLink,
  FileWarning,
  Loader2,
  Target,
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
import { Link } from "react-router-dom";
import { OrderAccuracyHeatmap } from "./OrderAccuracyHeatmap";
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
  "Article incorrect": "#f97316",
  "Problèmes liés à la qualité des aliments": "#eab308",
  "Commande incorrecte": "#3b82f6",
  "Personnalisation incorrecte": "#8b5cf6",
  "Autre": "#6b7280",
};

const ERROR_TYPE_LABELS: Record<string, string> = {
  "Articles manquants": "Articles manquants",
  "Article incorrect": "Article incorrect",
  "Problèmes liés à la qualité des aliments": "Qualité",
  "Commande incorrecte": "Commande incorrecte",
  "Personnalisation incorrecte": "Personnalisation",
  "Autre": "Autre",
};

export function OrderAccuracyDashboard({
  selectedRestaurant,
  selectedYear,
  selectedMonth,
  restaurants,
}: OrderAccuracyDashboardProps) {
  // Drill-down state
  const [drillDownMonth, setDrillDownMonth] = useState<number | null>(null);
  const [objective, setObjective] = useState(2); // 2% default objective
  const [chartType, setChartType] = useState<"line" | "bar">("bar");
  
  // Determine if we're in drill-down mode
  const periodMode = drillDownMonth !== null ? "month" : "year";
  const effectiveMonth = drillDownMonth !== null ? drillDownMonth : (selectedMonth === "all" ? null : selectedMonth);

  // Build date range filter
  const dateRange = useMemo(() => {
    if (drillDownMonth !== null) {
      // Drill-down mode: filter by specific month
      const startDate = new Date(selectedYear, drillDownMonth - 1, 1);
      const endDate = new Date(selectedYear, drillDownMonth, 0, 23, 59, 59);
      return { start: startDate.toISOString(), end: endDate.toISOString() };
    }
    
    const startDate = new Date(selectedYear, selectedMonth === "all" ? 0 : selectedMonth - 1, 1);
    const endDate = selectedMonth === "all"
      ? new Date(selectedYear, 11, 31, 23, 59, 59)
      : new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }, [selectedYear, selectedMonth, drillDownMonth]);

  // Fetch order errors - with explicit high limit to avoid default 1000 cap
  const { data: orderErrors, isLoading } = useQuery({
    queryKey: ["order-accuracy-stats-v2", selectedRestaurant, selectedYear, selectedMonth, drillDownMonth],
    queryFn: async () => {
      let query = supabase
        .from("order_errors")
        .select("*")
        .gte("error_date", dateRange.start)
        .lte("error_date", dateRange.end)
        .order("error_date", { ascending: true })
        .limit(10000); // Explicit limit to avoid default 1000 cap

      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching order errors:", error);
        throw error;
      }
      console.log(`Fetched ${data?.length || 0} order errors`);
      return data || [];
    },
  });

  // Fetch sales data from daily_sales_uber via RPC for error rate calculation
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

  // Fallback: Fetch order counts from orders table for restaurants missing from daily_sales_uber
  const { data: ordersFallbackData } = useQuery({
    queryKey: ["orders-fallback-for-error-rate", selectedRestaurant, selectedYear, restaurants, salesData],
    queryFn: async () => {
      const restaurantIds = selectedRestaurant === "all" 
        ? restaurants.map(r => r.id)
        : [selectedRestaurant];
      
      // Identify restaurants that have sales data already
      const restaurantsWithSales = new Set(
        (salesData || []).map((s: any) => s.restaurant_id)
      );
      
      // Find restaurants missing from salesData
      const missingRestaurantIds = restaurantIds.filter(id => !restaurantsWithSales.has(id));
      
      if (missingRestaurantIds.length === 0) return [];
      
      // Get order counts grouped by month and restaurant from orders table
      const startDate = new Date(selectedYear, 0, 1).toISOString();
      const endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();
      
      const { data, error } = await supabase
        .from("orders")
        .select("order_datetime, restaurant_id")
        .gte("order_datetime", startDate)
        .lte("order_datetime", endDate)
        .in("restaurant_id", missingRestaurantIds)
        .limit(50000); // High limit for fallback
      
      if (error) return [];
      
      // Group by month and restaurant
      const monthlyData: Record<string, { month: number; order_count: number; restaurant_id: string }> = {};
      (data || []).forEach((order: any) => {
        if (order.order_datetime) {
          const month = new Date(order.order_datetime).getMonth() + 1;
          const key = `${order.restaurant_id}-${month}`;
          if (!monthlyData[key]) {
            monthlyData[key] = { month, order_count: 0, restaurant_id: order.restaurant_id };
          }
          monthlyData[key].order_count += 1;
        }
      });
      
      return Object.values(monthlyData);
    },
    enabled: salesData !== undefined, // Run when salesData is available (even if empty)
  });

  // Combine sales data sources - merge daily_sales_uber with fallback from orders
  const effectiveSalesData = useMemo(() => {
    const combined = [...(salesData || []), ...(ordersFallbackData || [])];
    return combined;
  }, [salesData, ordersFallbackData]);

  // Check which restaurants are missing sales data
  const restaurantsWithMissingSales = useMemo(() => {
    if (selectedRestaurant !== "all") {
      const hasSales = effectiveSalesData.some((s: any) => s.restaurant_id === selectedRestaurant);
      if (!hasSales && orderErrors && orderErrors.length > 0) {
        return restaurants.filter(r => r.id === selectedRestaurant);
      }
      return [];
    }
    
    // For "all" restaurants, find which ones are missing
    const restaurantsWithSales = new Set(effectiveSalesData.map((s: any) => s.restaurant_id));
    const restaurantsWithErrors = new Set(orderErrors?.map((e: any) => e.restaurant_id) || []);
    
    return restaurants.filter(r => 
      restaurantsWithErrors.has(r.id) && !restaurantsWithSales.has(r.id)
    );
  }, [effectiveSalesData, orderErrors, restaurants, selectedRestaurant]);

  // Check if we have no sales data at all
  const hasSalesDataMissing = useMemo(() => {
    return restaurantsWithMissingSales.length > 0;
  }, [restaurantsWithMissingSales]);

  // Detect which months have error data
  const monthsWithErrors = useMemo(() => {
    if (!orderErrors) return new Set<number>();
    const months = new Set<number>();
    orderErrors.forEach(error => {
      const date = new Date(error.error_date || error.created_at);
      const month = date.getMonth() + 1;
      months.add(month);
    });
    return months;
  }, [orderErrors]);

  // Calculate order count for current period (only for months with error data)
  const orderCount = useMemo(() => {
    if (!effectiveSalesData || effectiveSalesData.length === 0) return 0;
    
    if (drillDownMonth !== null) {
      return effectiveSalesData
        .filter((r: any) => r.month === drillDownMonth)
        .reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
    }
    
    if (selectedMonth !== "all") {
      return effectiveSalesData
        .filter((r: any) => r.month === selectedMonth)
        .reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
    }
    
    // Only count orders for months that have error data
    return effectiveSalesData
      .filter((r: any) => monthsWithErrors.has(r.month))
      .reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
  }, [effectiveSalesData, selectedMonth, drillDownMonth, monthsWithErrors]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!orderErrors) return null;

    const totalErrors = orderErrors.length;
    const totalImpact = orderErrors.reduce((sum, e) => sum + (e.financial_impact || 0), 0);
    const avgImpact = totalErrors > 0 ? totalImpact / totalErrors : 0;
    const errorRate = orderCount && orderCount > 0 ? (totalErrors / orderCount) * 100 : 0;
    const meetsObjective = errorRate <= objective;

    return {
      totalErrors,
      totalImpact,
      avgImpact,
      errorRate,
      orderCount: orderCount || 0,
      meetsObjective,
    };
  }, [orderErrors, orderCount, objective]);

  // Build error rate evolution data
  const errorRateEvolutionData = useMemo(() => {
    if (!orderErrors || !effectiveSalesData) return [];

    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

    if (drillDownMonth !== null) {
      // Daily data for the selected month
      const dailyErrors: Record<number, number> = {};
      const daysInMonth = new Date(selectedYear, drillDownMonth, 0).getDate();
      
      for (let d = 1; d <= daysInMonth; d++) {
        dailyErrors[d] = 0;
      }

      orderErrors.forEach(error => {
        const date = new Date(error.error_date || error.created_at);
        const day = date.getDate();
        dailyErrors[day] = (dailyErrors[day] || 0) + 1;
      });

      const monthOrderCount = effectiveSalesData
        .filter((r: any) => r.month === drillDownMonth)
        .reduce((sum: number, r: any) => sum + (r.order_count || 0), 0);
      const dailyAvgOrders = monthOrderCount / daysInMonth;

      return Object.entries(dailyErrors).map(([day, count]) => ({
        period: `${selectedYear}-${String(drillDownMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        label: `${day}`,
        errorRate: dailyAvgOrders > 0 ? (count / dailyAvgOrders) * 100 : 0,
        errorCount: count,
        orderCount: Math.round(dailyAvgOrders),
      }));
    }

    // Monthly data
    const monthlyErrors: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyErrors[m] = 0;
    }

    orderErrors.forEach(error => {
      const date = new Date(error.error_date || error.created_at);
      const month = date.getMonth() + 1;
      monthlyErrors[month] = (monthlyErrors[month] || 0) + 1;
    });

    // Group sales data by month
    const monthlyOrderCounts: Record<number, number> = {};
    effectiveSalesData.forEach((r: any) => {
      monthlyOrderCounts[r.month] = (monthlyOrderCounts[r.month] || 0) + (r.order_count || 0);
    });

    // Only show months that have error data (exclude months without imports)
    return Object.entries(monthlyErrors)
      .filter(([month]) => monthsWithErrors.has(parseInt(month)))
      .map(([month, count]) => {
        const orders = monthlyOrderCounts[parseInt(month)] || 0;
        return {
          period: `${selectedYear}-${String(month).padStart(2, "0")}`,
          label: monthNames[parseInt(month) - 1],
          errorRate: orders > 0 ? (count / orders) * 100 : 0,
          errorCount: count,
          orderCount: orders,
        };
      });
  }, [orderErrors, effectiveSalesData, selectedYear, drillDownMonth, monthsWithErrors]);

  // Top problematic items
  const topItems = useMemo(() => {
    if (!orderErrors) return [];

    const grouped: Record<string, { title: string; count: number; impact: number }> = {};

    orderErrors.forEach((error) => {
      if (!error.item_title) return;
      const key = error.item_title;
      
      if (!grouped[key]) {
        grouped[key] = { title: key, count: 0, impact: 0 };
      }
      grouped[key].count += 1;
      grouped[key].impact += error.financial_impact || 0;
    });

    return Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [orderErrors]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const handleDrillDown = (month: number) => {
    setDrillDownMonth(month);
  };

  const handleBackToYear = () => {
    setDrillDownMonth(null);
  };

  const handlePrevMonth = () => {
    if (drillDownMonth && drillDownMonth > 1) {
      setDrillDownMonth(drillDownMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (drillDownMonth && drillDownMonth < 12) {
      setDrillDownMonth(drillDownMonth + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orderErrors || orderErrors.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileWarning className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Aucune donnée disponible</p>
          <p className="text-muted-foreground text-center max-w-md">
            Importez vos rapports d'erreurs de commandes depuis Uber Eats pour visualiser les statistiques opérationnelles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warning if sales data missing for some restaurants */}
      {hasSalesDataMissing && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            <strong>Données de ventes manquantes pour {restaurantsWithMissingSales.length} restaurant(s) :</strong>{" "}
            {restaurantsWithMissingSales.slice(0, 5).map(r => r.name).join(", ")}
            {restaurantsWithMissingSales.length > 5 && ` et ${restaurantsWithMissingSales.length - 5} autre(s)`}.
            Le taux d'erreur peut être imprécis. Importez le rapport "Sales Over Time" depuis la page{" "}
            <a href="/report-import" className="underline font-medium hover:text-amber-600">Imports</a>.
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
            <div className={`text-2xl font-bold ${kpis?.meetsObjective ? "text-primary" : "text-destructive"}`}>
              {kpis?.errorRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis?.totalErrors} erreurs / {kpis?.orderCount} commandes
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
            <div className={`text-2xl font-bold ${kpis?.meetsObjective ? "text-primary" : "text-destructive"}`}>
              {kpis?.meetsObjective ? "✓ Atteint" : "✗ Non atteint"}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis?.meetsObjective 
                ? `${(objective - (kpis?.errorRate || 0)).toFixed(2)}% sous l'objectif`
                : `${((kpis?.errorRate || 0) - objective).toFixed(2)}% au-dessus`
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
              Erreurs totales
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.totalErrors}</div>
            <p className="text-xs text-muted-foreground">
              Commandes avec problèmes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Rate Evolution with Objective */}
      <ErrorRateEvolutionChart
        data={errorRateEvolutionData}
        objective={objective}
        onObjectiveChange={setObjective}
        chartType={chartType}
        onChartTypeChange={setChartType}
        periodMode={periodMode}
        selectedMonth={drillDownMonth}
        onDrillDown={handleDrillDown}
        onBackToYear={handleBackToYear}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      {/* Charts Row: Financial Impact + Heatmap */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FinancialImpactByCategory orderErrors={orderErrors} />
        <OrderAccuracyHeatmap orderErrors={orderErrors} />
      </div>

      {/* Top Problematic Items */}
      {topItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">TOP 10 - Articles problématiques</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topItems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={200}
                  className="text-xs"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.length > 30 ? `${value.slice(0, 27)}...` : value}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "count" ? value : formatCurrency(value),
                    name === "count" ? "Occurrences" : "Impact",
                  ]}
                />
                <Legend />
                <Bar dataKey="count" name="Occurrences" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Errors Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Détail des erreurs</CardTitle>
          {/* TODO: Implémenter la contestation via IA ultérieurement */}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Article</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drillDownMonth !== null ? orderErrors : orderErrors.slice(0, 50)).map((error) => (
                  <TableRow key={error.id}>
                    <TableCell>
                      {new Date(error.error_date || error.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: ERROR_TYPE_COLORS[error.error_category || "Autre"],
                          color: ERROR_TYPE_COLORS[error.error_category || "Autre"],
                        }}
                      >
                        {ERROR_TYPE_LABELS[error.error_category || "Autre"] || error.error_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {error.item_title || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {error.error_description || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatCurrency(error.financial_impact || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {drillDownMonth === null && orderErrors.length > 50 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Affichage des 50 premières erreurs sur {orderErrors.length}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
