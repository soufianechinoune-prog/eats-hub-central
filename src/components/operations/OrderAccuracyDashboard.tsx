import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  TrendingUp,
  Euro,
  Package,
  ExternalLink,
  FileWarning,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Link } from "react-router-dom";

interface OrderAccuracyDashboardProps {
  selectedRestaurant: string;
  selectedYear: number;
  selectedMonth: number | "all";
  restaurants: Array<{ id: string; name: string }>;
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  missing_item: "#ef4444",
  wrong_item: "#f97316",
  quality: "#eab308",
  late: "#3b82f6",
  damaged: "#8b5cf6",
  other: "#6b7280",
};

const ERROR_TYPE_LABELS: Record<string, string> = {
  missing_item: "Article manquant",
  wrong_item: "Mauvais article",
  quality: "Qualité",
  late: "Retard",
  damaged: "Endommagé",
  other: "Autre",
};

export function OrderAccuracyDashboard({
  selectedRestaurant,
  selectedYear,
  selectedMonth,
  restaurants,
}: OrderAccuracyDashboardProps) {
  // Build date range filter
  const dateRange = useMemo(() => {
    const startDate = new Date(selectedYear, selectedMonth === "all" ? 0 : selectedMonth - 1, 1);
    const endDate = selectedMonth === "all"
      ? new Date(selectedYear, 11, 31, 23, 59, 59)
      : new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }, [selectedYear, selectedMonth]);

  // Fetch order errors
  const { data: orderErrors, isLoading } = useQuery({
    queryKey: ["order-accuracy-stats", selectedRestaurant, selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("order_errors")
        .select("*")
        .gte("error_date", dateRange.start)
        .lte("error_date", dateRange.end)
        .order("error_date", { ascending: true });

      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch order count for the period (to calculate error rate)
  const { data: orderCount } = useQuery({
    queryKey: ["order-count", selectedRestaurant, selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("monthly_revenue")
        .select("order_count")
        .eq("year", selectedYear);

      if (selectedMonth !== "all") {
        query = query.eq("month", selectedMonth);
      }

      if (selectedRestaurant !== "all") {
        query = query.eq("restaurant_id", selectedRestaurant);
      }

      const { data, error } = await query;
      if (error) return 0;
      return data?.reduce((sum, r) => sum + (r.order_count || 0), 0) || 0;
    },
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!orderErrors) return null;

    const totalErrors = orderErrors.length;
    const totalImpact = orderErrors.reduce((sum, e) => sum + (e.financial_impact || 0), 0);
    const avgImpact = totalErrors > 0 ? totalImpact / totalErrors : 0;
    const errorRate = orderCount && orderCount > 0 ? (totalErrors / orderCount) * 100 : 0;

    return {
      totalErrors,
      totalImpact,
      avgImpact,
      errorRate,
      orderCount: orderCount || 0,
    };
  }, [orderErrors, orderCount]);

  // Group errors by date for trend chart
  const trendData = useMemo(() => {
    if (!orderErrors) return [];

    const grouped: Record<string, { date: string; count: number; impact: number }> = {};

    orderErrors.forEach((error) => {
      const date = new Date(error.error_date || error.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      if (!grouped[key]) {
        grouped[key] = { date: key, count: 0, impact: 0 };
      }
      grouped[key].count += 1;
      grouped[key].impact += error.financial_impact || 0;
    });

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [orderErrors]);

  // Group errors by type for pie chart
  const errorsByType = useMemo(() => {
    if (!orderErrors) return [];

    const grouped: Record<string, number> = {};

    orderErrors.forEach((error) => {
      const category = error.error_category || "other";
      grouped[category] = (grouped[category] || 0) + 1;
    });

    return Object.entries(grouped).map(([name, value]) => ({
      name: ERROR_TYPE_LABELS[name] || name,
      value,
      color: ERROR_TYPE_COLORS[name] || ERROR_TYPE_COLORS.other,
    }));
  }, [orderErrors]);

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

  const formatMonth = (dateStr: string) => {
    const [year, month] = dateStr.split("-");
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
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
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taux d'erreurs
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
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

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Évolution des erreurs</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatMonth}
                  className="text-xs"
                />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "count" ? value : formatCurrency(value),
                    name === "count" ? "Erreurs" : "Impact",
                  ]}
                  labelFormatter={formatMonth}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="count"
                  name="Nombre d'erreurs"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--destructive))" }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="impact"
                  name="Impact (€)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition par type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={errorsByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {errorsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Problematic Items */}
      {topItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">TOP 10 - Articles problématiques</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topItems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={150}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "count" ? value : formatCurrency(value),
                    name === "count" ? "Occurrences" : "Impact",
                  ]}
                />
                <Legend />
                <Bar dataKey="count" name="Occurrences" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Errors Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Détail des erreurs</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/disputes">
              <ExternalLink className="mr-2 h-4 w-4" />
              Contester via IA
            </Link>
          </Button>
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
                {orderErrors.slice(0, 50).map((error) => (
                  <TableRow key={error.id}>
                    <TableCell>
                      {new Date(error.error_date || error.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: ERROR_TYPE_COLORS[error.error_category || "other"],
                          color: ERROR_TYPE_COLORS[error.error_category || "other"],
                        }}
                      >
                        {ERROR_TYPE_LABELS[error.error_category || "other"] || error.error_type}
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
            {orderErrors.length > 50 && (
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
