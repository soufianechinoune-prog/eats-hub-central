import { useMemo, useState } from "react";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Tag, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, ShieldAlert, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useOffersAnalytics, type RestaurantOfferStats } from "@/hooks/useOffersAnalytics";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend, Cell,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
];

type SortKey = "restaurantName" | "totalOrders" | "promoOrders" | "promoPercent" | "taxedOrders" | "taxedPercent" | "totalFees" | "avgFeePerTaxed";

export function OffersAnalyticsSection() {
  const {
    selectedRestaurants,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
  } = useAnalyticsContext();

  const [sortKey, setSortKey] = useState<SortKey>("totalFees");
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch restaurants
  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants-list"],
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("id, name").eq("is_active", true);
      return data || [];
    },
  });

  // Date range
  const { startDate, endDate } = useMemo(() => {
    if (periodMode === "range" && dateRange?.from && dateRange?.to) {
      return { startDate: format(dateRange.from, "yyyy-MM-dd"), endDate: format(dateRange.to, "yyyy-MM-dd") };
    }
    if (periodMode === "month" && selectedMonth > 0) {
      const s = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      const e = endOfMonth(s);
      return { startDate: format(s, "yyyy-MM-dd"), endDate: format(e, "yyyy-MM-dd") };
    }
    const s = startOfYear(new Date(selectedYear, 0));
    const e = new Date() < endOfYear(s) ? new Date() : endOfYear(s);
    return { startDate: format(s, "yyyy-MM-dd"), endDate: format(e, "yyyy-MM-dd") };
  }, [selectedYear, selectedMonth, periodMode, dateRange]);

  const restaurantIds = selectedRestaurants.length > 0
    ? selectedRestaurants
    : restaurants.map((r) => r.id);

  const { isLoading, isError, errorMessage, kpis, restaurantStats, monthlyStats, heatmapData, anomalies } = useOffersAnalytics(
    restaurantIds, startDate, endDate, restaurants
  );

  // Sort handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortedStats = useMemo(() => {
    return [...restaurantStats].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string") return sortAsc ? (va as string).localeCompare(vb as string) : (vb as string).localeCompare(va as string);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [restaurantStats, sortKey, sortAsc]);

  // Chart data
  const chartData = useMemo(() => {
    // Get top 8 restaurants by total fees
    const topRestaurants = [...restaurantStats].sort((a, b) => b.totalFees - a.totalFees).slice(0, 8);
    const topIds = new Set(topRestaurants.map((r) => r.restaurantId));

    return monthlyStats.map((m) => {
      const entry: Record<string, any> = {
        month: m.monthKey,
        label: format(new Date(m.monthKey + "-01"), "MMM yyyy", { locale: fr }),
        taxedPercent: Math.round(m.taxedPercent),
      };
      let otherFees = 0;
      Object.entries(m.byRestaurant).forEach(([rid, data]) => {
        if (topIds.has(rid)) {
          const name = restaurants.find((r) => r.id === rid)?.name || rid.slice(0, 8);
          entry[name] = Math.round(data.fees * 100) / 100;
        } else {
          otherFees += data.fees;
        }
      });
      entry["Autres"] = Math.round(otherFees * 100) / 100;
      return entry;
    });
  }, [monthlyStats, restaurantStats, restaurants]);

  const chartKeys = useMemo(() => {
    const topRestaurants = [...restaurantStats].sort((a, b) => b.totalFees - a.totalFees).slice(0, 8);
    const keys = topRestaurants.map((r) => r.restaurantName);
    keys.push("Autres");
    return keys;
  }, [restaurantStats]);

  // Heatmap
  const heatmapRestaurants = useMemo(() => {
    const rSet = new Map<string, string>();
    heatmapData.forEach((h) => rSet.set(h.restaurantId, h.restaurantName));
    return Array.from(rSet.entries()).map(([id, name]) => ({ id, name }));
  }, [heatmapData]);

  const heatmapMonths = useMemo(() => {
    const mSet = new Set<string>();
    heatmapData.forEach((h) => mSet.add(h.monthKey));
    return Array.from(mSet).sort();
  }, [heatmapData]);

  const heatmapMap = useMemo(() => {
    const m = new Map<string, number>();
    heatmapData.forEach((h) => m.set(`${h.restaurantId}-${h.monthKey}`, h.promoPercent));
    return m;
  }, [heatmapData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const feesTrend = kpis.totalFeesPrev > 0
    ? ((kpis.totalFees - kpis.totalFeesPrev) / kpis.totalFeesPrev) * 100
    : null;

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" /> Total Frais d'offre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalFees.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€</div>
            {feesTrend !== null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${feesTrend > 0 ? "text-destructive" : "text-accent"}`}>
                {feesTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {feesTrend > 0 ? "+" : ""}{feesTrend.toFixed(1)}% vs N-1
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">% Commandes taxées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.taxedPercent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.taxedOrdersCount.toLocaleString("fr-FR")} / {kpis.promoOrdersCount.toLocaleString("fr-FR")} promo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Frais moyen / commande</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avgFeePerTaxed.toFixed(2)}€</div>
            <p className="text-xs text-muted-foreground mt-1">
              Attendu : ~0.89€
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux d'utilisation offres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.promoRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.promoOrdersCount.toLocaleString("fr-FR")} / {kpis.totalOrders.toLocaleString("fr-FR")} commandes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Restaurant Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Analyse par restaurant</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: "totalFees" as SortKey, label: "💰 Plus de frais" },
              { key: "promoPercent" as SortKey, label: "📊 % Promo" },
              { key: "taxedPercent" as SortKey, label: "🏷️ % Taxé" },
              { key: "totalOrders" as SortKey, label: "📦 Volume" },
              { key: "avgFeePerTaxed" as SortKey, label: "💵 Frais/cmd" },
              { key: "restaurantName" as SortKey, label: "🔤 Nom" },
            ]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleSort(opt.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  sortKey === opt.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {opt.label}
                {sortKey === opt.key && (sortAsc ? " ↑" : " ↓")}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Restaurant" field="restaurantName" />
                  <SortHeader label="Commandes" field="totalOrders" />
                  <SortHeader label="Promo" field="promoOrders" />
                  <SortHeader label="% Promo" field="promoPercent" />
                  <SortHeader label="Taxées" field="taxedOrders" />
                  <SortHeader label="% Taxé/Promo" field="taxedPercent" />
                  <SortHeader label="Total frais" field="totalFees" />
                  <SortHeader label="Frais/cmd" field="avgFeePerTaxed" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStats.map((rs) => (
                  <TableRow key={rs.restaurantId} className={rs.isExempt ? "bg-accent/5" : ""}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {rs.restaurantName}
                      {rs.isExempt && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">Exonéré</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{rs.totalOrders.toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-right tabular-nums">{rs.promoOrders.toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-right tabular-nums">{rs.promoPercent.toFixed(1)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{rs.taxedOrders.toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rs.promoOrders > 0 ? `${rs.taxedPercent.toFixed(1)}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {rs.totalFees > 0 ? `${rs.totalFees.toFixed(0)}€` : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rs.taxedOrders > 0 ? `${rs.avgFeePerTaxed.toFixed(2)}€` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Evolution Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Évolution mensuelle des frais d'offre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
                  <YAxis yAxisId="left" className="text-xs fill-muted-foreground" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} className="text-xs fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string) =>
                      name === "% taxé" ? [`${value}%`, name] : [`${value.toFixed(0)}€`, name]
                    }
                  />
                  <Legend />
                  {chartKeys.map((key, i) => (
                    <Bar key={key} yAxisId="left" dataKey={key} stackId="fees" fill={COLORS[i % COLORS.length]} />
                  ))}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="taxedPercent"
                    name="% taxé"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap */}
      {heatmapRestaurants.length > 0 && heatmapMonths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Couverture des offres par restaurant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-1 font-medium text-muted-foreground sticky left-0 bg-card z-10">Restaurant</th>
                    {heatmapMonths.map((m) => (
                      <th key={m} className="p-1 text-center font-medium text-muted-foreground min-w-[50px]">
                        {format(new Date(m + "-01"), "MMM yy", { locale: fr })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapRestaurants.map((r) => (
                    <tr key={r.id}>
                      <td className="p-1 whitespace-nowrap font-medium sticky left-0 bg-card z-10">{r.name}</td>
                      {heatmapMonths.map((m) => {
                        const pct = heatmapMap.get(`${r.id}-${m}`) || 0;
                        const opacity = Math.min(pct / 80, 1);
                        return (
                          <td key={m} className="p-1 text-center">
                            <div
                              className="rounded px-1 py-0.5 text-[10px] tabular-nums"
                              style={{
                                backgroundColor: `hsl(var(--primary) / ${opacity * 0.6})`,
                                color: opacity > 0.4 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                              }}
                            >
                              {pct > 0 ? `${pct.toFixed(0)}%` : "-"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Détection d'anomalies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomalies.map((a, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  a.type === "should_be_exempt"
                    ? "border-destructive/30 bg-destructive/5"
                    : a.type === "overcharged"
                    ? "border-orange-500/30 bg-orange-500/5"
                    : "border-accent/30 bg-accent/5"
                }`}
              >
                {a.type === "should_be_exempt" ? (
                  <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                ) : a.type === "overcharged" ? (
                  <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-sm">{a.restaurantName}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
