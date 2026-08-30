import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeliverooLogo } from "@/components/icons/PlatformIcons";
import { cn } from "@/lib/utils";

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";
const fmtEur2 = (v: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " €";
const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(v);

interface SummaryTotals {
  revenue: number;
  orders: number;
  commission: number;
  net: number;
}
interface DailyRow {
  day: string;
  revenue: number;
  orders: number;
}
interface RestoRow {
  restaurant_id: string;
  restaurant_name: string | null;
  revenue: number;
  orders: number;
  commission: number;
  net: number;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

export interface DeliverooChannelSummaryProps {
  restaurantIds: string[];
  startDate: string;
  endDate: string;
  periodLabel?: string;
}

export function DeliverooChannelSummary({
  restaurantIds,
  startDate,
  endDate,
  periodLabel,
}: DeliverooChannelSummaryProps) {
  const enabled = restaurantIds.length > 0 && !!startDate && !!endDate;

  const { data, isLoading } = useQuery({
    queryKey: ["deliveroo-channel-summary", restaurantIds, startDate, endDate],
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_deliveroo_channel_summary", {
        p_start_date: startDate,
        p_end_date: endDate,
        p_restaurant_ids: restaurantIds,
      });
      if (error) throw error;
      const raw = (data ?? {}) as any;
      const totals: SummaryTotals = {
        revenue: num(raw?.totals?.revenue),
        orders: num(raw?.totals?.orders),
        commission: num(raw?.totals?.commission),
        net: num(raw?.totals?.net),
      };
      const daily: DailyRow[] = (raw?.daily ?? []).map((d: any) => ({
        day: d.day,
        revenue: num(d.revenue),
        orders: num(d.orders),
      }));
      const restaurants: RestoRow[] = (raw?.restaurants ?? []).map((r: any) => ({
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurant_name,
        revenue: num(r.revenue),
        orders: num(r.orders),
        commission: num(r.commission),
        net: num(r.net),
      }));
      return { totals, daily, restaurants };
    },
  });

  const kpis = useMemo(() => {
    const t = data?.totals;
    if (!t) return null;
    return {
      revenue: t.revenue,
      orders: t.orders,
      avgBasket: t.orders > 0 ? t.revenue / t.orders : 0,
      commission: t.commission,
      commissionPct: t.revenue > 0 ? (t.commission / t.revenue) * 100 : 0,
      net: t.net,
    };
  }, [data]);

  if (!enabled) {
    return (
      <Card className="border-2 border-deliveroo/30">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sélectionnez au moins un restaurant pour afficher la synthèse Deliveroo.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="CA Deliveroo"
          value={isLoading ? null : fmtEur(kpis?.revenue ?? 0)}
          accent
          sublabel={periodLabel}
        />
        <KpiCard label="Commandes" value={isLoading ? null : fmtInt(kpis?.orders ?? 0)} />
        <KpiCard label="Panier moyen" value={isLoading ? null : fmtEur2(kpis?.avgBasket ?? 0)} />
        <KpiCard
          label="Commission"
          value={isLoading ? null : fmtEur(kpis?.commission ?? 0)}
          sublabel={kpis ? `${kpis.commissionPct.toFixed(1).replace(".", ",")} % du CA` : undefined}
        />
        <KpiCard
          label="Versement net"
          value={isLoading ? null : fmtEur(kpis?.net ?? 0)}
          valueClass="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Daily evolution */}
      <Card className="border-2 border-deliveroo/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <DeliverooLogo size={18} />
            <CardTitle className="text-base">Évolution quotidienne</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (data?.daily.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune commande Deliveroo sur cette période.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data!.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(v: string) => format(parseISO(v), "d MMM", { locale: fr })}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v: number) => fmtEur(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => format(parseISO(String(v)), "EEEE d MMMM", { locale: fr })}
                  formatter={(value: any, name: string) =>
                    name === "CA" ? [fmtEur(Number(value)), "CA"] : [fmtInt(Number(value)), "Commandes"]
                  }
                />
                <Bar yAxisId="left" dataKey="revenue" name="CA" fill="hsl(var(--deliveroo))" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders"
                  name="Commandes"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card className="border-2 border-deliveroo/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Classement des restaurants · Deliveroo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (data?.restaurants.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune donnée Deliveroo sur cette période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pl-4 pr-2 text-left font-semibold">#</th>
                    <th className="py-2 px-2 text-left font-semibold">Restaurant</th>
                    <th className="py-2 px-2 text-right font-semibold">CA</th>
                    <th className="py-2 px-2 text-right font-semibold">Cmds</th>
                    <th className="py-2 px-2 text-right font-semibold">Panier</th>
                    <th className="py-2 px-2 text-right font-semibold">Commission</th>
                    <th className="py-2 pr-4 pl-2 text-right font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.restaurants.map((r, i) => {
                    const pct = r.revenue > 0 ? (r.commission / r.revenue) * 100 : 0;
                    return (
                      <tr key={r.restaurant_id} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-2 pl-4 pr-2 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="py-2 px-2 font-medium">{r.restaurant_name ?? "—"}</td>
                        <td className={cn("py-2 px-2 text-right font-semibold tabular-nums text-deliveroo")}>
                          {fmtEur(r.revenue)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{fmtInt(r.orders)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {fmtEur2(r.orders > 0 ? r.revenue / r.orders : 0)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {fmtEur(r.commission)}{" "}
                          <span className="text-muted-foreground text-xs">
                            ({pct.toFixed(1).replace(".", ",")} %)
                          </span>
                        </td>
                        <td className="py-2 pr-4 pl-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {fmtEur(r.net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  accent,
  valueClass,
}: {
  label: string;
  value: string | null;
  sublabel?: string;
  accent?: boolean;
  valueClass?: string;
}) {
  return (
    <Card className={cn("border", accent ? "border-deliveroo/40 bg-deliveroo/5" : "border-border/60")}>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {value === null ? (
          <Skeleton className="h-7 w-24 mt-2" />
        ) : (
          <p className={cn("mt-1 text-2xl font-bold tabular-nums", accent && "text-deliveroo", valueClass)}>
            {value}
          </p>
        )}
        {sublabel && <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}
