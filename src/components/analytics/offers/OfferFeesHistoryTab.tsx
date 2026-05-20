import { useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Tag, TrendingDown, TrendingUp, ShoppingBag, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend, Area, AreaChart, LineChart,
} from "recharts";
import type { OffersAnalyticsResult } from "@/hooks/useOffersAnalytics";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
];

interface Props {
  data: OffersAnalyticsResult;
  restaurants: { id: string; name: string }[];
}

export function OfferFeesHistoryTab({ data, restaurants }: Props) {
  const { kpis, monthlyStats, restaurantStats } = data;

  const feesTrend = kpis.totalFeesPrev > 0
    ? ((kpis.totalFees - kpis.totalFeesPrev) / kpis.totalFeesPrev) * 100
    : null;

  // Sparkline data (last 12 monthly points available)
  const sparkData = useMemo(() => {
    return monthlyStats.slice(-12).map((m) => ({
      month: m.monthKey,
      fees: Math.round(m.totalFees * 100) / 100,
    }));
  }, [monthlyStats]);

  // Global monthly history (bars = fees, line = taxed orders)
  const globalHistory = useMemo(() => {
    return monthlyStats.map((m) => ({
      label: format(new Date(m.monthKey + "-01"), "MMM yyyy", { locale: fr }),
      fees: Math.round(m.totalFees * 100) / 100,
      taxedOrders: m.taxedOrders,
      avgFee: m.taxedOrders > 0 ? +(m.totalFees / m.taxedOrders).toFixed(2) : 0,
    }));
  }, [monthlyStats]);

  // Per-restaurant lines (top 8)
  const perRestaurantData = useMemo(() => {
    const topRestaurants = [...restaurantStats]
      .filter((r) => r.totalFees > 0)
      .sort((a, b) => b.totalFees - a.totalFees)
      .slice(0, 8);
    const topIds = new Set(topRestaurants.map((r) => r.restaurantId));

    const points = monthlyStats.map((m) => {
      const entry: Record<string, any> = {
        label: format(new Date(m.monthKey + "-01"), "MMM yyyy", { locale: fr }),
      };
      let otherFees = 0;
      Object.entries(m.byRestaurant).forEach(([rid, d]) => {
        if (topIds.has(rid)) {
          const name = restaurants.find((r) => r.id === rid)?.name || rid.slice(0, 8);
          entry[name] = Math.round(d.fees * 100) / 100;
        } else {
          otherFees += d.fees;
        }
      });
      entry["Autres"] = Math.round(otherFees * 100) / 100;
      return entry;
    });

    const keys = topRestaurants.map((r) => r.restaurantName);
    keys.push("Autres");

    return { points, keys };
  }, [monthlyStats, restaurantStats, restaurants]);

  return (
    <div className="space-y-6">
      {/* HERO BANNER */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Total */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tag className="h-4 w-4" /> Frais d'offres facturés (période)
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="text-5xl font-bold tracking-tight">
                  {kpis.totalFees.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€
                </div>
                {feesTrend !== null && (
                  <Badge
                    variant="outline"
                    className={`gap-1 text-sm ${
                      feesTrend > 0
                        ? "border-destructive/30 text-destructive bg-destructive/5"
                        : "border-accent/30 text-accent bg-accent/5"
                    }`}
                  >
                    {feesTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {feesTrend > 0 ? "+" : ""}{feesTrend.toFixed(1)}% vs N-1
                  </Badge>
                )}
              </div>
              {sparkData.length > 1 && (
                <div className="h-12 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData}>
                      <defs>
                        <linearGradient id="sparkFees" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="fees"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#sparkFees)"
                      />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(v: number) => [`${v.toFixed(0)}€`, "Frais"]}
                        labelFormatter={(l) => format(new Date(l + "-01"), "MMM yyyy", { locale: fr })}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Tendance sur les {sparkData.length} derniers mois disponibles
              </p>
            </div>

            {/* Taxed orders */}
            <div className="space-y-2 border-l border-border/50 pl-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ShoppingBag className="h-4 w-4" /> Commandes taxées
              </div>
              <div className="text-3xl font-semibold">{kpis.taxedOrdersCount.toLocaleString("fr-FR")}</div>
              <p className="text-xs text-muted-foreground">
                sur {kpis.promoOrdersCount.toLocaleString("fr-FR")} commandes promo
                <br />
                ({kpis.taxedPercent.toFixed(1)}% taxées)
              </p>
            </div>

            {/* Avg fee vs expected */}
            <div className="space-y-2 border-l border-border/50 pl-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calculator className="h-4 w-4" /> Frais moyen / commande
              </div>
              <div className="text-3xl font-semibold">{kpis.avgFeePerTaxed.toFixed(2)}€</div>
              <p className="text-xs text-muted-foreground">
                Attendu : <span className="font-medium">0,89€</span> HT
                {kpis.avgFeePerTaxed > 0 && (
                  <span className={`block mt-1 ${
                    Math.abs(kpis.avgFeePerTaxed - 0.89) < 0.05
                      ? "text-accent"
                      : "text-orange-500"
                  }`}>
                    Écart : {kpis.avgFeePerTaxed > 0.89 ? "+" : ""}
                    {(kpis.avgFeePerTaxed - 0.89).toFixed(2)}€
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GLOBAL HISTORY */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Historique global — Frais & commandes taxées</span>
            <Badge variant="outline" className="font-normal text-xs">Mensuel</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {globalHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée sur la période.</p>
          ) : (
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={globalHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
                  <YAxis yAxisId="left" className="text-xs fill-muted-foreground" tickFormatter={(v) => `${v}€`} />
                  <YAxis yAxisId="right" orientation="right" className="text-xs fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number, name: string) => {
                      if (name === "Frais") return [`${value.toFixed(0)}€`, name];
                      if (name === "Frais moyen") return [`${value.toFixed(2)}€`, name];
                      return [value.toLocaleString("fr-FR"), name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="fees" name="Frais" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="taxedOrders" name="Commandes taxées" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="avgFee" name="Frais moyen" stroke="hsl(var(--destructive))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PER RESTAURANT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Évolution par restaurant — Top 8</CardTitle>
        </CardHeader>
        <CardContent>
          {perRestaurantData.points.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée sur la période.</p>
          ) : (
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perRestaurantData.points}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
                  <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `${v}€`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number, name: string) => [`${value.toFixed(0)}€`, name]}
                  />
                  <Legend />
                  {perRestaurantData.keys.map((key, i) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={key === "Autres" ? 1.5 : 2}
                      strokeDasharray={key === "Autres" ? "4 4" : undefined}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
